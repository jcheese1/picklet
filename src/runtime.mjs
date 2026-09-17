// Shared by training and the generated artifact. No external runtime dependencies.
export function features(text, buckets, profile = 'word-character') {
  const normalized = text.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'");
  const words = normalized.match(/[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu) ?? [];
  const counts = new Map();
  const add = (value, weight = 1) => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
    const index = (hash >>> 0) % buckets;
    counts.set(index, (counts.get(index) ?? 0) + weight);
  };
  if (profile === 'japanese-character') {
    // Character windows preserve short Japanese terms without a dictionary or
    // platform-dependent word segmenter. Punctuation separates spans.
    for (const span of words) {
      const chars = [...`^${span}$`];
      for (let n = 2; n <= 5; n++) for (let i = 0; i <= chars.length - n; i++) add(`j:${chars.slice(i, i + n).join('')}`);
    }
  } else for (let i = 0; i < words.length; i++) {
    add(`w:${words[i]}`, 2);
    if (i + 1 < words.length) add(`b:${words[i]} ${words[i + 1]}`, 2);
    if (i + 2 < words.length) add(`t:${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    const padded = `^${words[i]}$`;
    for (let n = 3; n <= 5; n++) for (let k = 0; k <= padded.length - n; k++) add(`c:${padded.slice(k, k + n)}`, 0.5);
  }
  let norm = 0;
  const values = [...counts].map(([index, value]) => { const scaled = Math.sqrt(value); norm += scaled * scaled; return [index, scaled]; });
  norm = Math.sqrt(norm) || 1;
  return values.map(([index, value]) => [index, value / norm]);
}

export function softmax(logits) {
  const max = Math.max(...logits);
  const exp = logits.map(value => Math.exp(value - max));
  const total = exp.reduce((a, b) => a + b, 0);
  return exp.map(value => value / total);
}

export function makeSwitch(model) {
  const binary = atob(model.weights);
  const weights = Int8Array.from(binary, char => char.charCodeAt(0));
  const count = model.branches.length + 1;
  if (weights.length !== model.buckets * count || model.bias.length !== count || model.scales.length !== count) throw new Error('Invalid compiled model');
  const labels = [...model.branches.map(branch => branch.id), '__fallback'];
  const predict = input => {
    if (typeof input !== 'string') throw new TypeError('picklet expects a string');
    if (input.length > model.maxInputLength) throw new RangeError(`Input exceeds ${model.maxInputLength} characters`);
    const vector = features(input, model.buckets, model.featureProfile);
    const logits = model.bias.slice();
    for (let c = 0; c < count; c++) for (const [index, value] of vector) logits[c] += weights[c * model.buckets + index] * model.scales[c] * value;
    const scores = softmax(logits);
    const order = scores.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score);
    const top = order[0];
    const margin = top.score - order[1].score;
    const reason = !vector.length ? 'empty-input' : top.index === count - 1 ? 'learned-fallback' : top.score < model.policy.minScore || margin < model.policy.minMargin ? 'uncertain' : 'selected';
    const details = {
      candidates: order.filter(candidate => candidate.index < count - 1).map(candidate => ({ case: labels[candidate.index], score: candidate.score })),
      fallbackScore: scores[count - 1], margin,
    };
    return reason === 'selected'
      ? { kind: 'match', case: labels[top.index], ...details }
      : { kind: 'abstain', reason, ...details };
  };
  predict.match = async (input, handlers) => {
    if (!handlers || typeof handlers !== 'object' || Array.isArray(handlers)) throw new TypeError('Provide a handler object');
    const expected = [...labels.slice(0, -1), 'otherwise'];
    const actual = Reflect.ownKeys(handlers);
    if (actual.length !== expected.length || actual.some(key => !expected.includes(key))) throw new Error('Provide exactly the compiled case IDs and otherwise');
    // Capture own data properties once. Getters/inherited properties are not handlers.
    const checked = new Map();
    for (const key of expected) {
      const property = Object.getOwnPropertyDescriptor(handlers, key);
      if (!property || typeof property.value !== 'function') throw new TypeError(`Handler ${key} must be a function`);
      checked.set(key, property.value);
    }
    const decision = predict(input);
    return await checked.get(decision.kind === 'match' ? decision.case : 'otherwise')({ input, decision });
  };
  predict.metadata = Object.freeze({ name: model.name, branches: Object.freeze(model.branches.map(branch => Object.freeze({ ...branch }))), policy: Object.freeze({ ...model.policy }), parameters: weights.length + count, weightBytes: weights.byteLength, training: Object.freeze({ ...model.training }) });
  return predict;
}
