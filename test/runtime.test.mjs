import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import swtich from '../dist/support-switch.mjs';
import { validateSpec } from '../src/train.mjs';
import { defineSwitch } from '../src/define.mjs';

function register(log, value = 'ok') {
  return Object.fromEntries([
    ...swtich.metadata.branches.map(({ id }) => [id, async ({ decision }) => { assert.equal(decision.case, id); log.push(id); return value; }]),
    ['otherwise', ({ decision }) => { assert.equal(decision.kind, 'abstain'); log.push('fallback'); return 'fallback'; }],
  ]);
}

test('only the chosen handler runs, once, and its async result is returned', async () => {
  const log = [];
  assert.equal(await swtich.match('I want a refund', register(log, 'returned')), 'returned');
  assert.deepEqual(log, ['refund']);
});

test('empty input runs only otherwise', async () => {
  const log = [];
  assert.equal(await swtich.match('', register(log)), 'fallback');
  assert.deepEqual(log, ['fallback']);
  assert.equal(swtich('   ').reason, 'empty-input');
});

test('incomplete and unknown handler maps fail before executing handlers', async () => {
  let executed = 0;
  await assert.rejects(swtich.match('refund please', { refund: () => executed++ }), /exactly/);
  await assert.rejects(swtich.match('refund please', { ...register([]), surprise: () => executed++ }), /exactly/);
  await assert.rejects(swtich.match('refund please', { ...register([]), refund: 'not a function' }), /must be a function/);
  assert.equal(executed, 0);
});

test('model selection is independent of object key order', async () => {
  const output = await swtich.match('I want a refund', {
    sales: () => 'sales', otherwise: () => 'fallback', support: () => 'support', refund: () => 'refund',
  });
  assert.equal(output, 'refund');
});

test('handler exceptions propagate without running another branch', async () => {
  let count = 0;
  await assert.rejects(swtich.match('I want a refund', {
    refund: () => { count++; throw new Error('billing unavailable'); },
    support: () => count++, sales: () => count++, otherwise: () => count++,
  }), /billing unavailable/);
  assert.equal(count, 1);
});

test('invalid inputs throw instead of becoming abstention', async () => {
  assert.throws(() => swtich({ message: 'hello' }), /string/);
  assert.throws(() => swtich('x'.repeat(4001)), /exceeds/);
  const log = [];
  await assert.rejects(swtich.match(null, register(log)), /string/);
  assert.deepEqual(log, []);
});

test('the generated artifact loads from a data URL with no imports or network', async () => {
  const source = await readFile(new URL('../dist/support-switch.mjs', import.meta.url), 'utf8');
  const isolated = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  assert.deepEqual(isolated.default('How much does your product cost?'), swtich('How much does your product cost?'));
  assert.deepEqual(Object.keys(isolated), ['default']);
});

test('prediction is synchronous and candidates are ranked without an internal fallback label', () => {
  const decision = swtich('I want a refund');
  assert.equal(decision.kind, 'match');
  assert.equal(decision.case, 'refund');
  assert.equal(decision.then, undefined);
  assert.deepEqual(decision.candidates.map(c => c.case).sort(), ['refund', 'sales', 'support']);
  assert.ok(decision.candidates.every((candidate, i, all) => i === 0 || all[i - 1].score >= candidate.score));
  assert.ok(Math.abs(decision.candidates.reduce((sum, c) => sum + c.score, decision.fallbackScore) - 1) < 1e-12);
  assert.equal('case' in swtich(''), false);
});

test('every frozen evaluation score and selected case is unchanged by the interface migration', async () => {
  const baseline = JSON.parse(await readFile(new URL('./fixtures/predictions-v0.json', import.meta.url)));
  for (const { text, decision: previous } of baseline) {
    const next = swtich(text);
    assert.equal(next.kind === 'match' ? next.case : null, previous.branch, text);
    assert.equal(next.margin, previous.margin, text);
    assert.equal(next.fallbackScore, previous.scores.__fallback, text);
    for (const candidate of next.candidates) assert.equal(candidate.score, previous.scores[candidate.case], text);
  }
});

test('inherited or getter handlers are rejected without executing them', async () => {
  let read = false;
  const inherited = Object.create(register([]));
  await assert.rejects(swtich.match('refund', inherited), /exactly/);
  const accessor = { ...register([]), get refund() { read = true; return () => 'refund'; } };
  await assert.rejects(swtich.match('refund', accessor), /must be a function/);
  assert.equal(read, false);
});

test('definition converts named cases and explicit otherwise examples into training data', async () => {
  const spec = JSON.parse(await readFile(new URL('../examples/support.switch.json', import.meta.url)));
  const definition = defineSwitch(Object.fromEntries(spec.branches.map(branch => [branch.id, branch])), {
    ...spec, calibration: spec.calibration.map(row => ({ ...row, label: row.label === '__fallback' ? 'otherwise' : row.label })),
  });
  assert.deepEqual(definition.branches, spec.branches);
  assert.deepEqual(definition.calibration, spec.calibration);
  assert.throws(() => defineSwitch({ ...Object.fromEntries(spec.branches.map(branch => [branch.id, branch])), otherwise: spec.branches[0] }, spec), /non-reserved/);
});

test('compiler rejects overlapping calibration and contradictory training examples', async () => {
  const spec = JSON.parse(await readFile(new URL('../examples/support.switch.json', import.meta.url)));
  spec.calibration[0].text = spec.branches[0].examples[0];
  assert.throws(() => validateSpec(spec), /overlap/);
  spec.calibration[0].text = 'A new calibration example';
  spec.branches[1].examples.push(spec.branches[0].examples[0]);
  assert.throws(() => validateSpec(spec), /Duplicate training/);
});

test('evaluation cases are disjoint from training and calibration', async () => {
  const spec = JSON.parse(await readFile(new URL('../examples/support.switch.json', import.meta.url)));
  const cases = JSON.parse(await readFile(new URL('../examples/support.test.json', import.meta.url)));
  const normalize = text => text.toLowerCase().trim();
  const seen = new Set([...spec.branches.flatMap(b => b.examples), ...spec.fallbackExamples, ...spec.calibration.map(row => row.text)].map(normalize));
  for (const row of cases) assert.equal(seen.has(normalize(row.text)), false, row.text);
});
