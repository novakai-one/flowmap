/* =====================================================================
   onboard.test.mjs — AUD5/F-09: the handoff-freshness state must surface
   at session START, not only at clean session Stop.

   Attack A8: the Stop-hook nudge fires only on a clean Stop — a session
   that crashes mid-operation never gets the freshness nudge, so the next
   session starts on a stale handoff with no warning. Start-of-session is
   crash-proof: whatever killed the last session, the next one always
   onboards. (F4 CI remains the hard backstop that blocks the merge.)

   NOTE: this spawns the real onboard (flowmap:verify + roadmap), so it is
   the slowest test in the suite — one spawn, all assertions share it.
   Deny-side smoke tests (stale map => exit 1) are F-17's scope.

   FLOWMAP_ROADMAP_SKIP_CMD: onboard's STEP 6 roadmap normally executes the
   roadmap.json cmd predicates — which spawn gate tools (incl. orchestrate
   with git worktrees) CONCURRENTLY with the rest of this suite and race it
   (seen in CI: a parallel orchestrate's worktree tripped orchestrate.test's
   cleanup assertion). Skipping cmds here only DOWNGRADES statuses
   (built -> partial, per roadmap.mjs); every file/grep predicate and every
   onboard step still runs for real.
   ===================================================================== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

const r = spawnSync('node', [join('tools', 'flowmap', 'onboard.mjs')],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 300_000,
    env: { ...process.env, FLOWMAP_ROADMAP_SKIP_CMD: '1' } });

test('onboard exits 0 on the real repo (the map at HEAD is trustworthy)', () => {
  assert.equal(r.status, 0, `onboard failed:\n${r.stdout}\n${r.stderr}`);
});

test('F-09: onboard surfaces the handoff-freshness state every session start', () => {
  assert.match(r.stdout, /handoff/i,
    'onboard output must mention the handoff-freshness check');
  assert.match(r.stdout, /HANDOFF (FRESH|LAGS THE CODE)/,
    'onboard must print the computed freshness verdict (fresh or lagging)');
});
