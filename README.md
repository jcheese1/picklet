# picklet — compile a tiny learned function

A working experiment in training a small classifier and bundling its weights directly into JavaScript. No runtime dependencies, model downloads, API keys, inference requests, or GPU are needed. The generated module works in Node and modern browsers.

This is an experimental compiler released under the MIT license. The compiler is reusable; the repository includes English and Japanese models for a narrow support inbox. The playground starts in Japanese and can switch between the two. The installable package contains the compiler, types, README, and license.

```js
import inbox from './dist/support-switch.mjs';

const decision = inbox(message); // synchronous; no handler executes

const result = await inbox.match(message, {
  refund: () => 'refund',
  support: () => 'support',
  sales: () => 'sales',
  otherwise: () => 'clarify',
});
```

Define case meanings once in the compiler input. At runtime, `.match()` accepts an object with exactly the compiled case IDs plus `otherwise`; it validates the object before inference, then invokes one handler. Handlers may be async. Handler failures propagate and do not trigger another case. Missing/unknown cases and invalid input throw instead of turning into abstention.

Prediction returns an explicit match or abstention, with ranked suggestions in both cases:

```js
const decision = inbox('Can I get my money back?');
if (decision.kind === 'match') {
  console.log(decision.case); // 'refund' | 'support' | 'sales'
} else {
  console.log(decision.reason); // 'empty-input' | 'learned-fallback' | 'uncertain'
}
console.log(decision.candidates); // [{ case, score }, ...], highest score first
console.log(decision.fallbackScore, decision.margin);
```

Scores are relative class scores, **not calibrated probabilities of correctness**. `candidates` contains the real case IDs; the model's fallback category has its own `fallbackScore`. `otherwise` means the model abstained, not that all other cases are proven inapplicable. Missing language understanding can still produce a wrong accepted branch. `inbox.metadata` exposes the model's case descriptions, size, training provenance and acceptance policy.

The compiler generates a standalone `.mjs` module and a matching `.d.mts` declaration file. TypeScript checks handler exhaustiveness and spelling, narrows the decision supplied to each handler, and infers the union of their awaited return values. For literal return tags, use `as const` as usual. The runtime module exports only the default predictor; there are no `.inspect()` or registration-callback compatibility aliases.

## Install

Install as a **development dependency**:

```sh
bun add -D picklet
# or
pnpm add -D picklet
# or
npm install --save-dev picklet
```

Version `0.1.0` is distributed under the `latest` tag. Pin the exact version for reproducible builds. You can also install the locally packed `artifacts/picklet-0.1.0.tgz` by passing its path in place of `picklet`.

Import `defineSwitch` from `picklet` in your definition, using the full training/calibration shape in **Compile another switch** below. Add this script to your application's `package.json`:

```json
{
  "scripts": {
    "train": "picklet compile inbox.switch.ts --out src/generated/inbox.mjs"
  }
}
```

Run `bun run train` or `pnpm run train`. Both invoke the local CLI. The CLI's Node shebang requires **Node 24+**; Bun is not required for pnpm consumers. For direct compilation on Bun 1.3+, use `bun --bun run train`.

The compiler writes `inbox.mjs`, `inbox.d.mts`, and `inbox.report.json`. Import the generated `.mjs` in your application. The model works without the `picklet` package at runtime; keep its adjacent `.d.mts` for TypeScript. Commit generated files or generate them in CI before removing development dependencies. Retrain explicitly when definitions or examples change; installation does not train or download a model.

To rebuild and verify the archive from this repository:

```sh
bun install --ignore-scripts --frozen-lockfile
bun run test
bun run typecheck
bun run pack
bun run test:package
```

`pack` only writes a local tarball. `test:package` requires Bun, pnpm, Node 24+, and the repository's TypeScript development dependency. It checks the archive contents, installs that exact archive in temporary Bun/pnpm applications, compiles English/Japanese TypeScript definitions through the installed CLI, checks generated types, and verifies standalone Node/Bun inference and browser bundling after removing the installed development package. Temporary consumers are cleaned up afterward.

The package has no runtime dependencies, native binaries, install hooks, or bundled example models. The source checkout contains the playground, fixtures, reports, and tests; those are excluded from the tarball.

## Run the source checkout

Node 24+ or Bun 1.3+. No install step is necessary for compiling, testing, or running the demo. TypeScript is a development-only dependency for `bun run typecheck`; install it with `bun install --ignore-scripts`.

```sh
node bin/picklet.mjs compile examples/support.switch.ts --out dist/support-switch.mjs
node scripts/evaluate.mjs
node --test test/*.test.mjs
node examples/demo.mjs "I cannot log in to my account"
node scripts/serve.mjs
```

Open <http://127.0.0.1:4621>. The playground includes the complete exam results and buttons exposing known failures. The local server only serves static files. Classification happens in the browser. The downloaded `dist/support-switch.mjs` contains everything required for inference.

Equivalent package scripts: `bun run compile`, `bun run evaluate`, `bun run test`, `bun run typecheck`, `bun run demo`, `bun run start`.

## Japanese experiment

The Japanese version uses Japanese descriptions, 150 authored base phrases expanded into 450 training rows, and 26 separate calibration cases. It keeps the same 16,388-parameter linear model, optimizer, seed and training duration. Select `language: 'ja'` in `defineSwitch` to use character 2–5-grams instead of word features; this preserves two-character terms such as `返金` without a Japanese dictionary or platform-dependent segmenter. It is a feature profile, not automatic language detection or pretrained Japanese knowledge.

```ts
export default defineSwitch({
  refund: { description: 'お客様が返金を希望している', examples: refundExamples },
  support: { description: 'お客様が操作の助けを求めている', examples: supportExamples },
  sales: { description: 'お客様が購入を検討している', examples: salesExamples },
}, {
  name: 'support-ja',
  language: 'ja',
  fallbackExamples,
  calibration,
});
```

The first experiment used the existing English-oriented features with Japanese training data. After examining that experiment's failures, a new 54-case Japanese audit was authored and frozen **before** changing the features. The character-based model was trained and calibrated without reading this new audit. No training examples, thresholds, or features were subsequently tuned against it. Both audits are authored by the same assistant as the training data; neither establishes independent user accuracy.

All rows below use the **same fresh 54-case Japanese audit**:

| Model | Correct raw top-1, including fallback | Correct final decision | Correctly handled actionable requests | Wrong accepted branches |
| --- | --- | --- | --- | --- |
| English-trained baseline | 19/54 | 19/54 | 1/36 | 0 |
| Japanese training, original word/character features | 31/54 | 23/54 | 7/36 | 2 |
| Japanese training, character 2–5-grams | 41/54 | 26/54 | 9/36 | 1 |

The final Japanese model correctly rejects 17/18 fallback requests. Its acceptance policy requires a score of at least 0.4 and a lead of at least 0.75 over the runner-up. This conservative margin, selected on the calibration set, explains why many correct first choices still abstain. One vague request (`困っているので担当の方と話したいです`) incorrectly routes to sales. Do not interpret 41/54 raw ranking accuracy as successful autonomous handling: the final decision score is 26/54.

The Japanese artifact is **16,397 bytes Brotli including runtime**, with no inference service or model download. Training took roughly half a second on this machine. Quantization changed no winning class across 476 training/calibration examples. Tests compare exported scores with the training implementation on the fresh audit, within floating-point summation tolerance. The existing English artifact and all 54 frozen English predictions remain unchanged.

```sh
bun run compile:ja
bun run evaluate:ja                # fresh audit; shown in the playground
bun run evaluate:ja-audit-baseline # English model on the same Japanese audit
bun run evaluate:ja-dev            # the initial Japanese exam, now development evidence
```

Definitions and data are in `examples/support.ja.switch.ts`, `examples/support.ja.switch.json`, and `examples/support.ja.audit.json`. `scripts/create-japanese-fixtures.mjs` and `scripts/create-japanese-audit.mjs` preserve the data authorship process; they do not call a teacher API. The first model and its reports are preserved as `dist/support-switch-ja-unsegmented.*` and `dist/evaluation-ja-audit-unsegmented.json`. Changing only the description strings would not teach Japanese: the examples provide the learning signal.

## What is actually learned?

The first baseline uses hashed word unigrams/bigrams/trigrams and character n-grams, followed by a learned linear softmax classifier. It has 4,096 features and four classes: **16,388 learned parameters**. This is a small statistical classifier, not a pretrained language model. Training is implemented in JavaScript using stochastic gradient descent and cross-entropy. The compiler quantizes weights to int8 and emits the tokenizer, inference code, learned weights, and branch metadata into one ES module.

There is no hidden keyword routing table. Text features are fixed; branch weights are learned. Features can collide, and local n-grams do not reliably represent long-distance negation or reasoning. Those limitations are visible in the evaluation.

The compiled model has about **16 KB of raw int8 weights**. Exact module, gzip, and Brotli sizes are recorded in `dist/support-switch.report.json`. Compressed transfer size is not runtime memory usage. Inference includes a decoded weight array, strings, and temporary feature allocations.

## Dataset and results

The included switch uses 450 training examples (150 base phrases expanded with three prefix/suffix variants), 26 separate calibration cases, and 54 separately authored evaluation cases. All were written by the assistant for this experiment. No external teacher model was called. `scripts/create-fixtures.mjs` documents the fixture source; it is not an automatic teacher pipeline. Branch descriptions identify classes; examples provide the training signal.

The compiler never reads the evaluation file. Thresholds are selected to maximize accepted calibration examples with zero calibration errors, then frozen before evaluation. This tiny calibration set cannot establish a low real-world error rate. The test is held out from training and threshold selection, but is not independent human or customer evidence. Prefix/suffix variants remain together in training; exact split overlap is checked.

The first frozen evaluation produced:

- **40/54** correct final decisions, including appropriate fallbacks.
- **29** accepted branches, of which **4 were wrong**.
- **25/36** actionable requests handled correctly.
- **15/18** fallback requests rejected correctly.
- Zero changed argmax predictions after int8 quantization across the 476 training/calibration examples checked by the compiler.

The interface migration preserves every original case decision and score on all 54 evaluation inputs exactly. This is checked against `test/fixtures/predictions-v0.json`. The training data, model architecture, seed and acceptance policy were held fixed.

Examples of failures: a negated refund request routes to refund; a weather question routes to support; a request with multiple intents selects one branch. The playground deliberately exposes these. No training examples or thresholds were changed to repair those test cases. See `dist/evaluation.json` for every outcome and machine-local warm Node timings; browser timing is shown separately.

This demonstrates compact local learning and execution. It does not demonstrate a general-purpose semantic model or production-ready routing. A stronger next experiment would compare a small sequence model and broader, independently labeled data against this frozen baseline.

## Compile another switch

Create a definition module using the package's build-time `defineSwitch` export:

```ts
import { defineSwitch } from 'picklet';

export default defineSwitch({
  refund: {
    description: 'The customer wants money returned',
    examples: [
      'I want a refund',
      'Please return my payment',
      'Give me my money back',
      'I was charged twice and want the extra payment refunded',
    ],
  },
  support: {
    description: 'The customer needs technical help',
    examples: [
      'I cannot log in',
      'Help me reset my password',
      'The application keeps crashing',
      'My account shows an error when I sign in',
    ],
  },
}, {
  name: 'inbox',
  fallbackExamples: [
    'What is the weather today?',
    'Tell me a joke',
    'Hello there',
    'I need help with something',
  ],
  calibration: [
    { text: 'Could you refund my purchase?', label: 'refund' },
    { text: 'I need the duplicate charge returned', label: 'refund' },
    { text: 'Can I get my payment back?', label: 'refund' },
    { text: 'The login page is broken', label: 'support' },
    { text: 'How do I recover my password?', label: 'support' },
    { text: 'Your app crashes at startup', label: 'support' },
    { text: 'Will it rain tomorrow?', label: 'otherwise' },
    { text: 'What should I cook tonight?', label: 'otherwise' },
    { text: 'Thanks for your time', label: 'otherwise' },
  ],
});
```

Save this complete starter definition as `inbox.switch.ts` and run the `train` script above. It is deliberately small to demonstrate the workflow; add diverse examples and separate calibration/test data before relying on its predictions. At runtime, this two-case model requires `refund`, `support`, and `otherwise` handlers.

The compiler requires at least two examples per branch, two fallback examples, and eight non-overlapping calibration examples. Case IDs must be unique and cannot use reserved names (`otherwise`, `__fallback`, `__proto__`, `constructor`, `prototype`). Use `otherwise` for calibration examples that should abstain. Keep a separate test file and recompile when branch meanings change.

The CLI accepts local `.ts`, `.mts`, `.mjs` definition modules, or the original low-level JSON shape. Modules execute as normal local build code. Node 24 loads erasable TypeScript syntax directly; the compiler does not bundle arbitrary application imports. Output must end in `.mjs`, and the adjacent declaration ends in `.d.mts`. The bundled example imports its existing frozen JSON dataset, so the meanings and examples still have one source.

An automatic teacher-data generator, richer sequence architecture, and production monitoring are future work.

## Inspiration and license

Inspired by [gpu-time](https://github.com/arikchakma/gpu-time)'s small local model approach and [Jev](https://typesafe.ai/) / [jevlike](https://github.com/vinnylarouge/jevlike)'s decision-oriented interfaces. This package implements its own fixed-branch linear classifier; it does not reproduce Jev or jevlike's architecture and does not include their model weights or training datasets. The included source-checkout examples were authored for this experiment.

MIT. See [LICENSE](./LICENSE).
