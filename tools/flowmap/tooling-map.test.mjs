#!/usr/bin/env node
/* =====================================================================
   tooling-map.test.mjs — the acceptance suite for the tooling map.
   ---------------------------------------------------------------------
   This is the CONTRACT. The tooling map (docs/flowmap/_tooling.mmd) is
   "done" only when every test here is green — never on a prose claim.

     DETERMINISTIC — bundling tools/ twice yields byte-identical output
     FRESH         — the committed _tooling.mmd equals a fresh bundle
     VALID         — validate.mjs (grammar) exits 0
     ARCHITECTURAL — flowmap-lint.mjs (anti file-mirror) exits 0
     COMPLETE+TRUE — tooling-coverage.mjs (every module mapped, every
                     %% src resolves) exits 0

   Run: node --test tools/flowmap/tooling-map.test.mjs
   ===================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const p = (...s) => join(ROOT, ...s);
const ROOT_TOOLS = p('docs', 'flowmap', 'root-tools.mmd');
const MAP = p('docs', 'flowmap', '_tooling.mmd');

function bundle() {
  return execFileSync('node', [p('tools', 'flowmap', 'bundle.mjs'), '--root', ROOT_TOOLS, '--dir', p('tools')],
    { encoding: 'utf8', cwd: ROOT });
}
function run(script, ...args) {
  // execFileSync throws if exit code != 0 — that IS the assertion.
  return execFileSync('node', [p('tools', 'flowmap', script), ...args], { encoding: 'utf8', cwd: ROOT });
}

test('DETERMINISTIC — two bundles are byte-identical', () => {
  assert.equal(bundle(), bundle());
});

test('FRESH — committed _tooling.mmd equals a fresh bundle', () => {
  assert.equal(readFileSync(MAP, 'utf8'), bundle(),
    'docs/flowmap/_tooling.mmd is stale — run `npm run flowmap:tooling:bundle`');
});

test('VALID — validate.mjs grammar check passes', () => {
  assert.doesNotThrow(() => run('validate.mjs', MAP));
});

test('ARCHITECTURAL — flowmap-lint passes (not a flat file-mirror)', () => {
  assert.doesNotThrow(() => run('flowmap-lint.mjs', MAP));
});

test('COMPLETE+TRUE — tooling-coverage passes', () => {
  assert.doesNotThrow(() => run('tooling-coverage.mjs',
    '--map', MAP, '--tools', p('tools'), '--allow', p('docs', 'flowmap', 'tooling-curation-allowlist.txt')));
});
