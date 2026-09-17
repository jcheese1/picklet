import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const archive = resolve(process.argv[2] ?? join(root, 'artifacts', `picklet-${manifest.version}.tgz`));
const workspace = await mkdtemp(join(tmpdir(), 'picklet-package-test-'));

function run(command, args, cwd) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, CI: 'true', NO_UPDATE_NOTIFIER: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${error.stdout ?? ''}${error.stderr ?? ''}`, { cause: error });
  }
}

try {
  const files = run('tar', ['-tzf', archive], root).trim().split('\n').filter(file => !file.endsWith('/')).sort();
  assert.deepEqual(files, [
    'package/LICENSE', 'package/README.md', 'package/bin/picklet.mjs', 'package/package.json',
    'package/src/declarations.mjs', 'package/src/define.d.mts', 'package/src/define.mjs',
    'package/src/runtime.mjs', 'package/src/train.mjs',
  ].sort(), 'Archive must contain only the compiler, types, and documentation');
  console.log(`✓ Archive contains exactly ${files.length} intended files`);

  for (const manager of ['bun', 'pnpm']) {
    const consumer = join(workspace, manager);
    await mkdir(consumer);
    await writeFile(join(consumer, 'package.json'), JSON.stringify({
      name: `picklet-${manager}-consumer`, private: true, type: 'module',
      scripts: {
        'train:en': 'picklet compile support.switch.ts --out generated/en.mjs',
        'train:ja': 'picklet compile support.ja.switch.ts --out generated/ja.mjs',
        'train:readme': 'picklet compile inbox.switch.ts --out generated/readme.mjs',
      },
    }));
    const installArgs = manager === 'bun'
      ? ['add', '--dev', '--ignore-scripts', '--cache-dir', join(workspace, 'bun-cache'), archive]
      : ['add', '--save-dev', '--ignore-scripts', '--offline', '--store-dir', join(workspace, 'pnpm-store'), archive];
    run(manager, installArgs, consumer);
    const installedManifest = JSON.parse(await readFile(join(consumer, 'node_modules/picklet/package.json'), 'utf8'));
    const consumerManifest = JSON.parse(await readFile(join(consumer, 'package.json'), 'utf8'));
    assert.equal(installedManifest.version, manifest.version);
    assert.ok(consumerManifest.devDependencies.picklet);
    assert.ok(!consumerManifest.dependencies?.picklet);
    assert.equal(Object.keys(installedManifest.dependencies ?? {}).length, 0);
    for (const name of ['support.switch.ts', 'support.switch.json', 'support.ja.switch.ts', 'support.ja.switch.json']) {
      await copyFile(join(root, 'examples', name), join(consumer, name));
    }
    const readme = await readFile(join(consumer, 'node_modules/picklet/README.md'), 'utf8');
    const starter = readme.split('## Compile another switch')[1]?.match(/```ts\n([\s\S]*?)```/)?.[1];
    assert.ok(starter, 'Published README must include a runnable definition');
    await writeFile(join(consumer, 'inbox.switch.ts'), starter);
    for (const language of ['en', 'ja', 'readme']) run(manager, ['run', `train:${language}`], consumer);
    // Exercise the compiler on Bun itself, in addition to the Node shebang above.
    if (manager === 'bun') {
      run('bun', ['node_modules/picklet/bin/picklet.mjs', 'compile', 'support.ja.switch.ts', '--out', 'generated/ja-bun.mjs'], consumer);
      const { default: nodeModel } = await import(pathToFileURL(join(consumer, 'generated/ja.mjs')).href);
      const { default: bunModel } = await import(pathToFileURL(join(consumer, 'generated/ja-bun.mjs')).href);
      assert.deepEqual(nodeModel.metadata, bunModel.metadata);
      const audit = JSON.parse(await readFile(join(root, 'examples/support.ja.audit.json'), 'utf8'));
      // Math.exp can differ by a few floating-point bits between V8 and JavaScriptCore.
      // Compare decisions and scores, rather than requiring identical decimal serialization.
      for (const { text } of audit) {
        const nodeDecision = nodeModel(text), bunDecision = bunModel(text);
        assert.equal(nodeDecision.kind, bunDecision.kind, text);
        assert.equal(nodeDecision.case, bunDecision.case, text);
        assert.equal(nodeDecision.reason, bunDecision.reason, text);
        assert.ok(Math.abs(nodeDecision.margin - bunDecision.margin) < 1e-12, text);
        assert.ok(Math.abs(nodeDecision.fallbackScore - bunDecision.fallbackScore) < 1e-12, text);
        nodeDecision.candidates.forEach((candidate, index) => {
          assert.equal(candidate.case, bunDecision.candidates[index].case, text);
          assert.ok(Math.abs(candidate.score - bunDecision.candidates[index].score) < 1e-12, text);
        });
      }
    }

    await writeFile(join(consumer, 'contract.mts'), `
import english from './generated/en.mjs';
import japanese from './generated/ja.mjs';
const result = await japanese.match('返金してください', {
  refund: async () => 'refunded' as const,
  support: () => 1 as const,
  sales: () => true as const,
  otherwise: () => null,
});
const typed: 'refunded' | 1 | true | null = result;
void typed;
const decision = english('Please refund this');
if (decision.kind === 'match') {
  const label: 'refund' | 'support' | 'sales' = decision.case;
  void label;
}
// @ts-expect-error Handler maps must be exhaustive.
japanese.match('返金してください', { refund: () => 1, otherwise: () => 0 });
// @ts-expect-error Unknown case names must fail.
japanese.match('返金してください', { refund: () => 1, support: () => 2, sales: () => 3, otherwise: () => 0, typo: () => 4 });
`);
    run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--strict', '--noEmit', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--resolveJsonModule', 'contract.mts', 'support.switch.ts', 'support.ja.switch.ts', 'inbox.switch.ts'], consumer);

    // Copy only generated modules into a directory outside the consumer's node_modules tree.
    const standalone = join(workspace, `${manager}-standalone`);
    await mkdir(standalone);
    for (const language of ['en', 'ja']) await copyFile(join(consumer, 'generated', `${language}.mjs`), join(standalone, `${language}.mjs`));
    await writeFile(join(standalone, 'check.mjs'), `
import assert from 'node:assert/strict';
import english from './en.mjs';
import japanese from './ja.mjs';
assert.equal(english('I want a refund').case, 'refund');
assert.equal(japanese('返金してください').case, 'refund');
assert.equal(japanese('ログインできません').case, 'support');
const calls = [];
const result = await japanese.match('大阪の天気はどうですか', {
  refund: () => calls.push('refund'), support: () => calls.push('support'),
  sales: () => calls.push('sales'), otherwise: async () => { calls.push('otherwise'); return 'clarify'; },
});
assert.equal(result, 'clarify');
assert.deepEqual(calls, ['otherwise']);
`);
    await rm(join(consumer, 'node_modules'), { recursive: true });
    run(process.execPath, ['check.mjs'], standalone);
    run('bun', ['check.mjs'], standalone);
    run('bun', ['build', 'ja.mjs', '--target', 'browser', '--outfile', 'browser.mjs'], standalone);
    run(process.execPath, ['--input-type=module', '-e', "import assert from 'node:assert/strict'; import model from './browser.mjs'; assert.equal(model('返金してください').case, 'refund');"], standalone);
    console.log(`✓ ${manager}: dev install → English/Japanese/README compile → TypeScript → Node/Bun inference without package → browser bundle`);
  }
} finally {
  await rm(workspace, { recursive: true, force: true });
}
