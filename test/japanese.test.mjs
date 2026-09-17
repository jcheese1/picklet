import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import japanese from '../dist/support-switch-ja.mjs';
import english from '../dist/support-switch.mjs';
import { features } from '../src/runtime.mjs';
import { train } from '../src/train.mjs';
import definition from '../examples/support.ja.switch.ts';

test('Japanese inference routes refund and login requests locally', async () => {
  assert.equal(japanese('返金してください').case, 'refund');
  assert.equal(japanese('ログインできません').case, 'support');
  let executed = 0;
  const result = await japanese.match('ログインできません', {
    refund: () => { throw new Error('wrong handler'); },
    support: ({ decision }) => { executed++; return decision.case; },
    sales: () => { throw new Error('wrong handler'); },
    otherwise: () => { throw new Error('wrong handler'); },
  });
  assert.equal(result, 'support');
  assert.equal(executed, 1);
});

test('Japanese model handles the weather example through otherwise', async () => {
  assert.equal(japanese('大阪の天気はどうですか').kind, 'abstain');
  const result = await japanese.match('大阪の天気はどうですか', {
    refund: () => 'refund', support: () => 'support', sales: () => 'sales', otherwise: () => 'clarify',
  });
  assert.equal(result, 'clarify');
});

test('Japanese character features preserve full-width normalization and differ by local word order', () => {
  assert.deepEqual(features('ＡＰＩの設定１２３', 4096, 'japanese-character'), features('APIの設定123', 4096, 'japanese-character'));
  assert.notDeepEqual(features('返金ではなく購入', 4096, 'japanese-character'), features('購入ではなく返金', 4096, 'japanese-character'));
  assert.equal(japanese.metadata.parameters, english.metadata.parameters);
});

test('Japanese train, calibration, first exam, and fresh audit are text-disjoint', async () => {
  const normalize = text => text.normalize('NFKC').toLowerCase().replace(/\s+/gu, '').replace(/[。、！？!?.,]/gu, '');
  const seen = new Set();
  const exam = JSON.parse(await readFile(new URL('../examples/support.ja.test.json', import.meta.url)));
  const audit = JSON.parse(await readFile(new URL('../examples/support.ja.audit.json', import.meta.url)));
  for (const text of [...definition.branches.flatMap(b => b.examples), ...definition.fallbackExamples, ...definition.calibration.map(r => r.text), ...exam.map(r => r.text), ...audit.map(r => r.text)]) {
    assert.equal(seen.has(normalize(text)), false, text);
    seen.add(normalize(text));
  }
});

test('exported Japanese scores match deterministic training across the fresh audit', async () => {
  const { model, quantizedScores } = train(definition);
  const source = await readFile(new URL('../dist/support-switch-ja.mjs', import.meta.url), 'utf8');
  const shipped = JSON.parse(source.match(/^const model = (.+);$/m)[1]);
  assert.equal(shipped.weights, model.weights);
  assert.deepEqual(shipped.bias, model.bias);
  assert.deepEqual(shipped.scales, model.scales);
  const rows = JSON.parse(await readFile(new URL('../examples/support.ja.audit.json', import.meta.url)));
  const labels = [...definition.branches.map(b => b.id), '__fallback'];
  for (const row of rows) {
    const expected = quantizedScores(row.text);
    const prediction = japanese(row.text);
    const scores = Object.fromEntries(prediction.candidates.map(c => [c.case, c.score]));
    scores.__fallback = prediction.fallbackScore;
    // The reference adds bias after the sum; the runtime starts its sum with bias.
    for (let i = 0; i < labels.length; i++) assert.ok(Math.abs(scores[labels[i]] - expected[i]) < 1e-12, row.text);
  }
});
