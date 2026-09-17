import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const options = { model: resolve(root, 'dist/support-switch.mjs'), cases: resolve(root, 'examples/support.test.json'), out: resolve(root, 'dist/evaluation.json') };
const args = process.argv.slice(2);
if (args.length % 2) throw new Error('Usage: evaluate.mjs [--model model.mjs] [--cases exam.json] [--out report.json]');
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].slice(2);
  if (!args[i].startsWith('--') || !Object.hasOwn(options, key)) throw new Error(`Unknown option: ${args[i]}`);
  options[key] = resolve(args[i + 1]);
}
const { default: swtich } = await import(pathToFileURL(options.model));
const cases = JSON.parse(await readFile(options.cases));
if (!Array.isArray(cases) || !cases.length) throw new Error('Provide a nonempty evaluation set');
const results = cases.map(row => {
  const decision = swtich(row.text);
  const actual = decision.kind === 'match' ? decision.case : '__fallback';
  return { ...row, actual, correct: actual === row.label, decision };
});
const accepted = results.filter(row => row.actual !== '__fallback');
const actionable = results.filter(row => row.label !== '__fallback');
const times = [];
for (let i = 0; i < 100; i++) swtich(cases[i % cases.length].text);
for (let i = 0; i < 1000; i++) {
  const started = performance.now(); swtich(cases[i % cases.length].text); times.push(performance.now() - started);
}
times.sort((a, b) => a - b);
const report = {
  model: swtich.metadata.name,
  rawTop1Correct: results.filter(row => {
    const top = row.decision.candidates[0];
    return (row.decision.fallbackScore > top.score ? '__fallback' : top.case) === row.label;
  }).length,
  count: results.length, correct: results.filter(row => row.correct).length,
  accepted: accepted.length, incorrectAccepted: accepted.filter(row => !row.correct).length,
  actionable: actionable.length, correctlyAccepted: accepted.filter(row => row.correct).length,
  fallbackCorrect: results.filter(row => row.label === '__fallback' && row.correct).length,
  expectedFallback: results.filter(row => row.label === '__fallback').length,
  slices: Object.fromEntries([...new Set(results.map(row => row.tag ?? 'untagged'))].map(tag => {
    const slice = results.filter(row => (row.tag ?? 'untagged') === tag);
    return [tag, { count: slice.length, correct: slice.filter(row => row.correct).length, accepted: slice.filter(row => row.actual !== '__fallback').length, incorrectAccepted: slice.filter(row => row.actual !== '__fallback' && !row.correct).length }];
  })),
  latency: { warmP50Ms: times[500], warmP95Ms: times[950], samples: 1000, runtime: `Node ${process.version}; this machine; warm CPU calls only` },
  note: 'Small assistant-authored evaluation, not independently collected user traffic. Scores are not calibrated probabilities of correctness. No thresholds were tuned against this test set.',
  results,
};
await writeFile(options.out, JSON.stringify(report, null, 2) + '\n');
console.log(`Model: ${report.model}`);
console.log(`Exam: ${report.correct}/${report.count} correct final decisions`);
console.log(`Raw top-1 before abstention: ${report.rawTop1Correct}/${report.count}`);
console.log(`Accepted: ${report.accepted}; incorrect accepted: ${report.incorrectAccepted}; actionable coverage: ${report.correctlyAccepted}/${report.actionable}`);
console.log(`Fallback: ${report.fallbackCorrect}/${report.expectedFallback} correctly rejected`);
console.log(`Warm CPU p50 ${report.latency.warmP50Ms.toFixed(3)} ms; p95 ${report.latency.warmP95Ms.toFixed(3)} ms`);
for (const row of results.filter(row => !row.correct)) console.log(`✗ ${row.label} → ${row.actual}: ${row.text}`);
