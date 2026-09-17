import { features, softmax } from './runtime.mjs';

export function validateSpec(spec) {
  if (spec?.language !== undefined && !['en', 'ja'].includes(spec.language)) throw new Error('Supported language profiles: en, ja');
  if (!spec || !Array.isArray(spec.branches) || spec.branches.length < 2 || !Array.isArray(spec.fallbackExamples) || spec.fallbackExamples.length < 2) throw new Error('Provide at least two branches and fallback examples');
  const names = new Map();
  for (const branch of spec.branches) {
    if (typeof branch.id !== 'string' || !branch.id.trim() || ['otherwise', '__fallback', '__proto__', 'constructor', 'prototype'].includes(branch.id) || typeof branch.description !== 'string' || !branch.description.trim() || !Array.isArray(branch.examples) || branch.examples.length < 2) throw new Error('Every branch needs a non-reserved id, description, and at least two examples');
    for (const name of new Set([branch.id, branch.description])) {
      if (names.has(name)) throw new Error(`Duplicate branch id or description: ${name}`);
      names.set(name, branch.id);
    }
  }
  const rows = spec.branches.flatMap((branch, label) => branch.examples.map(text => ({ text, label })));
  rows.push(...spec.fallbackExamples.map(text => ({ text, label: spec.branches.length })));
  if (rows.some(row => typeof row.text !== 'string' || !row.text.trim() || row.text.length > 4000)) throw new Error('Training examples must be nonempty strings of at most 4000 characters');
  const seen = new Map();
  for (const row of rows) {
    const normalized = row.text.toLowerCase().trim();
    if (seen.has(normalized)) throw new Error(`Duplicate training example: ${row.text}`);
    seen.set(normalized, row.label);
  }
  if (!Array.isArray(spec.calibration) || spec.calibration.length < 8) throw new Error('Provide at least eight separate calibration examples');
  for (const row of spec.calibration) {
    if (typeof row.text !== 'string' || !row.text.trim() || row.text.length > 4000 || ![...spec.branches.map(b => b.id), '__fallback'].includes(row.label)) throw new Error('Invalid calibration row');
    const normalized = row.text.toLowerCase().trim();
    if (seen.has(normalized)) throw new Error(`Training/calibration overlap: ${row.text}`);
    seen.set(normalized, row.label);
  }
  return rows;
}

export function train(spec, { buckets = 4096, epochs = 100, seed = 20260917 } = {}) {
  const rows = validateSpec(spec);
  const count = spec.branches.length + 1;
  const weights = new Float64Array(buckets * count);
  const bias = new Array(count).fill(0);
  const featureProfile = spec.language === 'ja' ? 'japanese-character' : 'word-character';
  const examples = rows.map(row => ({ ...row, vector: features(row.text, buckets, featureProfile) }));
  let state = seed >>> 0;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  for (let epoch = 0; epoch < epochs; epoch++) {
    for (let i = examples.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [examples[i], examples[j]] = [examples[j], examples[i]]; }
    const rate = 0.65 / (1 + epoch / 35);
    for (const row of examples) {
      const logits = bias.slice();
      for (let c = 0; c < count; c++) for (const [index, value] of row.vector) logits[c] += weights[c * buckets + index] * value;
      const scores = softmax(logits);
      for (let c = 0; c < count; c++) {
        const gradient = scores[c] - (row.label === c ? 0.98 : 0.02 / (count - 1));
        bias[c] -= rate * gradient;
        for (const [index, value] of row.vector) weights[c * buckets + index] -= rate * gradient * value;
      }
    }
    for (let i = 0; i < weights.length; i++) weights[i] *= 0.999;
  }
  const quantized = new Int8Array(weights.length);
  const scales = [];
  for (let c = 0; c < count; c++) {
    let max = 0;
    for (let i = 0; i < buckets; i++) max = Math.max(max, Math.abs(weights[c * buckets + i]));
    const scale = max / 127 || 1;
    scales.push(scale);
    for (let i = 0; i < buckets; i++) quantized[c * buckets + i] = Math.round(weights[c * buckets + i] / scale);
  }
  const model = {
    version: 1, name: spec.name, buckets, maxInputLength: 4000, featureProfile,
    branches: spec.branches.map(({ id, description }) => ({ id, description })),
    bias, scales, weights: Buffer.from(quantized.buffer).toString('base64'),
    policy: { minScore: 0, minMargin: 0 },
    training: { examples: rows.length, epochs, seed, featureProfile, architecture: `${featureProfile === 'japanese-character' ? 'hashed Japanese character 2–5-grams' : 'hashed word/character n-grams'} + linear softmax, int8 weights`, provenance: spec.provenance ?? 'user-provided examples' },
  };
  const score = (text, quantizedMode) => {
    const vector = features(text, buckets, featureProfile);
    return softmax(bias.map((b, c) => b + vector.reduce((sum, [index, value]) => sum + value * (quantizedMode ? quantized[c * buckets + index] * scales[c] : weights[c * buckets + index]), 0)));
  };
  return { model, floatScores: text => score(text, false), quantizedScores: text => score(text, true) };
}

export function calibrate(spec, score) {
  const labels = [...spec.branches.map(branch => branch.id), '__fallback'];
  const rows = spec.calibration.map(row => {
    const ranked = score(row.text).map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value);
    return { ...row, prediction: labels[ranked[0].index], score: ranked[0].value, margin: ranked[0].value - ranked[1].value };
  });
  let best = { accepted: -1, minScore: 1.01, minMargin: 1, errors: 0 };
  for (let s = 0.4; s <= 1.011; s += 0.025) for (let m = 0.05; m <= 0.951; m += 0.05) {
    const accepted = rows.filter(row => row.prediction !== '__fallback' && row.score >= s && row.margin >= m);
    const errors = accepted.filter(row => row.prediction !== row.label).length;
    if (errors === 0 && accepted.length > best.accepted) best = { accepted: accepted.length, minScore: +s.toFixed(3), minMargin: +m.toFixed(3), errors };
  }
  return { policy: { minScore: best.minScore, minMargin: best.minMargin }, calibration: { count: rows.length, accepted: best.accepted, acceptedErrors: best.errors, note: 'Thresholds selected on this small authored calibration set; not a statistical safety guarantee.' } };
}
