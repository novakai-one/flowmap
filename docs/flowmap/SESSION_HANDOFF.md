# Session handoff — verifiable, not prose

> **New agent: do not trust this document. Run `npm run flowmap:onboard` first.**
> Everything below is either a *runnable claim* (a command + expected result you
> can execute) or clearly-labelled *intent* (the remaining roadmap). The verified
> state of the app lives in the tools, not in this file.

## 0. Start here

```
npm run flowmap:onboard
```

Proves the map is true + complete as of HEAD, prints the 3 invariants, hands you the
quiz. Prove your read before any design claim:

```
npm run flowmap:quiz -- generate --n 12 --seed 1
# answer each from docs/flowmap/_bundle.mmd only, write answers.json, then:
npm run flowmap:quiz -- check --answers answers.json --seed 1   # 100% = handover trusted
```

## 0·now (2026-07-03, this session) — M4 BUILT: read is the primary surface — the boot decision is pure, sticky and acceptance-proven

M4 executed through the full loop (design contract `docs/flowmap/m4-read-primary-design.md` committed
doc-first; map-first fragments; plan red before code). The P1 flip from §0a is live: the app boots into
the unfold reading overlay via `resolveBootSurface` — a pure viewspec function (empty model → editor;
otherwise the stored surface is sticky and the default is read); `open()`/`close()` record the choice
under `SURFACE_KEY` (`flowmap.surface.v1`, a config key string, allowlisted like `LS_KEY`). Branch
`m4-read-primary`, commits doc `458068c` → map+plan `f176bde` → code `cba5ee0`. Each row runnable.

| What | Verify it yourself | Expect |
|---|---|---|
| **M4 is BUILT — computed, not prose** | `npm run flowmap:mvp` | `M4 — Read (unfold) migrated to main app (6/6)` [BUILT], zero manual lines |
| The behavioural contract was red before the code | `npm run flowmap:acceptance -- --plan docs/flowmap/plans/m4-read-primary.plan.json` | 10/10 green (strict normalize ×5, boot decision table ×5) |
| Plan coherent, fully landed | `npm run flowmap:plan-check -- --plan docs/flowmap/plans/m4-read-primary.plan.json` · `npm run flowmap:status -- --plan docs/flowmap/plans/m4-read-primary.plan.json` | coherent (6 changes, 7 deps) · 6 built |
| The boot flip is one live top-level line | `grep -n 'resolveBootSurface(' src/main.ts` | 1 hit (~line 236), in the boot block after the history baseline |
| Surface recorded at the transitions, not in persistView | `grep -c 'SURFACE_KEY' src/panel/unfold.ts` | 3 (import + open→'read' + close→'edit') |
| The new contract is mapped | `grep -c 'viewspec__AppSurface\|viewspec__normalizeSurface\|viewspec__resolveBootSurface' docs/flowmap/_bundle.mmd` · same for `unfold__ufOpen\|unfold__ufClose` | 25 · 21 |
| Reducer-style property tests joined the bundled suite | `node tools/buildspec/run-bundled-test.mjs tools/buildspec/viewspec.test.mjs` | 7/7 (5 M3 + 2 M4) |
| Whole suite green · typecheck clean | `npm run spec:test:all` · `npm run typecheck` | 300 pass 0 fail (285+6+2+7) · exit 0 |
| Map true + complete + in sync | `npm run flowmap:ship` → `git diff --stat docs/flowmap/_bundle.mmd` | DONE line · empty |
| Status ban holds on all docs | `npm run flowmap:roadmap:audit` | both scans ✓ |
| Run it | `npm run dev` → clear localStorage → reload | arrival = the reading overlay (5 region cards); ✕ → editor, reload stays editor; Read → reload stays read; `flowmap.surface.v1` holds `'read'`/`'edit'` |

**Runtime-verified this session** (headless Chromium DOM assertions against the dev server — the
Chrome-MCP extension was not connected): fresh profile boots READ and records `'read'`; ✕ returns to
the editor and survives reload; Read is sticky across reload; a garbage stored value (`'READ'`) falls
back to the read default; **0 console errors / 0 page exceptions across four reloads**.

**Honest boundaries (do not oversell):**
- `ufOpen`/`ufClose` are structure-only map nodes (ctx/DOM-bound closures); the acceptance-proven half
  is the pure pair (`normalizeSurface`/`resolveBootSurface`). The runtime paragraph above is the
  behavioural evidence for the DOM half.
- Tooling sharp edge found (not fixed, latent for any future closure node): `extract.mjs#findSymbol`
  takes the FIRST same-named declaration in document order, so a local variable named like a mapped
  closure reads as gate drift — hit by `treeRow`'s `open` local (renamed `isOpen` in `cba5ee0`).
- M4's title says "migrated to main app": unfold has lived in `src/panel` since before M3; what M4
  adds — and what its 6 predicates prove — is boot-primacy + the surface contract, per its intent line.
- The editor still fully boots underneath the overlay (deliberate: ✕ reveals a ready editor); cost is
  one editor first-paint on read boots.
- `sel`/`stage`/`query` restore-on-boot remains an open M5 decision, unchanged from M3's boundary.
- `main__firstRender` carries no `%% src` binding (an architectural node — main.ts boot code is
  module-level, no named function), so 5/6 plan targets are symbol-verifiable; the 6th is covered by
  the grep predicate on `src/main.ts` plus the runtime run.
- A 0-context verifier independently recomputed all of the above from commands alone; its verdict —
  delivered, with the real-browser runtime as the one boundary it cannot cross — is exactly what the
  headless-browser run above covers. "ViewSpec-driven rendering" is proven by M3's contract, not
  re-proven by M4's predicates.

**Next (Scenario 1):** Chris reviews/merges the M4 PR (doc → map+plan → code commit order). Then **M5**
(feature-migration checks, one plan per feature) is the open P2 item; the two CI partials (E4:
acceptance+plan-layout steps, F5: loop-e2e step in `spec-gate.yml`) remain the small open gaps;
`npm run flowmap:roadmap` / `npm run flowmap:mvp` compute all of it — never this file.

## Archive + durable edges

Superseded session entries live in `docs/flowmap/handoff-archive.md` (historical record,
nothing load-bearing). Sharp edges and standing human verdicts that outlive their session
entries live in `docs/flowmap/KNOWN_EDGES.md` — read that before designing against
tooling or unfold internals; do not re-derive them from the archive.
