/**
 * H5 — handoff content-falsifiability tests
 * Tests for checkContentClaims() using fixture strings (no real file dependency
 * except the git-history lookups for committed-file assertions).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkContentClaims } from './handoff-fresh.mjs';

test('flags a bold "Not yet committed" claim about a file that IS in git history', async () => {
  const text = [
    '**Not yet committed:** these files — `tools/flowmap/handoff-fresh.mjs`',
  ].join('\n');
  const violations = checkContentClaims(text);
  assert.ok(violations.length >= 1, `expected >= 1 violation, got ${violations.length}: ${JSON.stringify(violations)}`);
  assert.ok(
    violations[0].includes('tools/flowmap/handoff-fresh.mjs'),
    `violation should mention the path: ${violations[0]}`
  );
});

test('does NOT flag a claim about a path that has no git history', async () => {
  const text = [
    '**Not yet committed:** `tools/flowmap/does-not-exist-xyz.mjs` is working-tree-only.',
  ].join('\n');
  const violations = checkContentClaims(text);
  assert.strictEqual(violations.length, 0, `expected 0 violations, got: ${JSON.stringify(violations)}`);
});

test('does NOT flag benign mid-sentence prose containing "not yet committed"', async () => {
  const text = 'this code was not yet committed at the time of writing.';
  const violations = checkContentClaims(text);
  assert.strictEqual(violations.length, 0, `expected 0 violations (no false positive), got: ${JSON.stringify(violations)}`);
});

// The REAL handoff pattern that the first (same-block) implementation missed:
// a vague back-reference claim ("these files") whose file names live in a
// SEPARATE "**New files" bullet using project-relative names (`lib/...`).
test('catches the real two-bullet pattern: "these files" claim + a **New files list of COMMITTED files', async () => {
  const text = [
    '**New files (all in `tools/flowmap/`):** `lib/canonical.mjs`, `waves.mjs`, and tests `waves.test.mjs`.',
    '',
    '- **Not yet committed:** these files are working-tree-only until committed. (`git status` shows them untracked.)',
  ].join('\n');
  const violations = checkContentClaims(text);
  assert.ok(violations.length >= 1, `the real two-bullet pattern must be caught, got: ${JSON.stringify(violations)}`);
});

// And it must stay quiet when those same listed files are genuinely uncommitted.
test('does NOT flag a "these files" claim when the listed files have no git history', async () => {
  const text = [
    '**New files:** `tools/flowmap/ghost-aaa.mjs`, `tools/flowmap/ghost-bbb.mjs`.',
    '',
    '- **Not yet committed:** these files are working-tree-only.',
  ].join('\n');
  const violations = checkContentClaims(text);
  assert.strictEqual(violations.length, 0, `expected 0 violations, got: ${JSON.stringify(violations)}`);
});
