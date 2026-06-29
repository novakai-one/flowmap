# Session handoff — verifiable, not prose

> **New agent: do not trust this document. Run `npm run flowmap:onboard` first.**
> Everything below is either a *runnable claim* (a command + expected result you
> can execute) or clearly-labelled *intent* (the remaining roadmap). The verified
> state of the app lives in the tools, not in this file. Written 2026-06-30.

## 0. Start here (the whole point of this session)

```
npm run flowmap:onboard
```

That command (a) proves the map is true + complete as of HEAD, (b) gives you the 3
durable invariants, (c) points you at the verified artifacts, (d) hands you a
comprehension quiz that turns "do you understand the app?" into a pass/fail test.
Take the quiz before making any design claim:

```
npm run flowmap:quiz -- generate --n 12 --seed 1
# answer each from docs/flowmap/_bundle.mmd only, write answers.json, then:
npm run flowmap:quiz -- check --answers answers.json --seed 1   # 100% = handover trusted
```

## 1. What this session changed — each row is a runnable claim

| What | Verify it yourself | Expect |
|---|---|---|
| **The map was stale** (4 real exports missing: `downstreamCone`, `applyPlan`, `sliceIds`, `sliceStubs` + plan types). Now re-synced. | `npm run flowmap:gate` | ✓ in sync |
| **A1 — symbol-level completeness gate.** New exports in existing files can no longer hide. | `npm run flowmap:exports` | PASS (195 symbols) |
| A1 fails closed on a hidden export | add `export function foo(){}` to any mapped .ts, then `npm run flowmap:exports` | exit 1, names it |
| **A2 — completeness wired into CI** | read `.github/workflows/spec-gate.yml` | "symbol completeness" step |
| **A3 — two-parser conformance** (app `fromMermaid` vs pipeline `parseMmd` proven to agree) | `npm run spec:conformance` | 15/15 pass |
| **A4 — trust tiers** (which claims are PROVEN vs advisory vs unverified) | `npm run flowmap:trust` | 2227 verified · 323 advisory · 281 unverified |
| **C1 — verified work-state** (continuity without prose) | `npm run flowmap:status -- --plan public/plan.json` | 8 built · 8 pending, derived from code |
| **B2 — testable understanding** | the quiz commands above | 100% or it names your misses |
| **B1 — one onboarding door** | `npm run flowmap:onboard` | MAP TRUSTWORTHY + protocol |
| Nothing regressed | `npm run spec:test` · `npm run typecheck` | 7/7 · clean |

New files: `tools/flowmap/{exports-coverage,status,quiz,onboard,trust-report}.mjs`,
`docs/flowmap/curation-allowlist.txt`. Edited: `package.json` (new scripts),
`spec-gate.yml`, the `plan`/`state` fragments + regenerated `_bundle.mmd`.

The curation allowlist (`docs/flowmap/curation-allowlist.txt`) is the auditable list
of exports deliberately NOT mapped (config scalars, trivial type aliases). Editing it
is a design decision, not a workaround.

## 2. What "green" now means (and still does not)

`npm run flowmap:verify` green ⟺ the map is **structurally true and complete**: every
exported symbol is a node or an audited exclusion, every node exists in code, and every
gated signature (arity, member names, void-vs-value, clean types) matches. It does **not**
yet mean: full param/return types (31 prose holes — see `flowmap:trust`), interface field
shapes, **edges** (hand-authored, unverified), or **behaviour**. Treat edges and `desc`
as advisory until the features below land.

## 3. Remaining roadmap — INTENT, not verified state (label kept honest)

Built this session: **Phase A** complete (A1 symbol-completeness, A2 CI, A3 parser-conformance,
A4 trust-tiers), **Phase B** (onboarding + quiz), **Phase C1** (verified work-state). Not yet built:

- **C2 — plan dry-run cert**: one command that takes an English-derived `plan.json` and
  certifies it round-trips (apply → spec:stubs → tsc → gate) before a human sees it.
- **D1 — layout fidelity**: planner/diff overlay must render on the human's real
  `ctx.state` positions, not the force-sim. *The canvas is the human layer — this matters.*
- **D2 — unify** the `diffWorkspace` and `planner` review surfaces into one path.
- **E2 — behavioural acceptance tests in the contract** (the second keystone): an approved
  change generates failing tests; "done" = signature-gate green AND those tests green.
- **E3 — writeback**: approved/implemented code updates the fragments automatically, so the
  loop closes without the manual fragment edit that caused this session's drift.
- **E4 — CI enforces the whole loop** (map fresh+complete + plan changes gate-green + tests green).

The end-to-end target: 0-context agent → `flowmap:onboard` (trusted understanding) →
build plan → human reviews visual diff in-app → approval exports an enforceable spec +
tests → agent implements to green → `flowmap:ship` re-syncs the map. C2/D/E2/E3/E4 are
what remain to make that loop fully closed and error-free.
