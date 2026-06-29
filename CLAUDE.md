## What flowmap is workign towards:
I must be able to start new claude instance with 0 context -> have claude use the flowmap features that either exist today or need to exist (e.g. read _bundle.mmd) -> claude needs to now have verifiable and testable understanding, not a prose subjective yes/no -> the handover is trusted, understanding verified at enough to have meaningful design discussion on app -> then it deviates with two scenarios here, similar, but  slightly differenet -> scenario 1(I ask claude to continue where last claude left off - currently only posssible in prose, high risk break point), scenario 2 (I ask claude in human language to build a feature, fix a bug etc.) -> Then claude needs to be able to build the plan, provide the flowmap files -> I can then paste these into the flowmap app to see visually the diff vs today and all the changes, blast radius etc. (I believe this is the part where a lot is already reasonably solid) -> Then this gets approved, with the approval creating an export that can be handed back to claude to implenment with tests that are verifiable, and it needs to ensure that now the flwomap data in the app is up to date and maintained.  ... this is the type of workflow that flowmap is built for - end to end codebase understanding, design, planning and implenentation, error free.

## the above is human language given to claude. Below this is Claudes response and understanding:

! Important ! -> the state below cannot be trusted. You should assume state as stale unless you have verified yourself.

# Flowmap Feature Set

## The Spine

The flowmap loop as described by claude loop: **understand → (continue | design) → plan → review → approve → implement → re-sync**

Every handoff is a verifiable artifact, never prose.

### Two Keystones

- **Keystone 1 — testable understanding** (makes the handover trusted)
- **Keystone 2 — behavioral acceptance tests in the contract** (makes implementation error-free, not just correctly-shaped)

---

## Phase A — Make the map a trustworthy substrate

> Until green means true AND complete, no downstream step can be trusted.

### A1 — Symbol-level completeness gate

Every exported symbol must be a node or an explicit, listed curation exclusion. Closes the exact hole that caused this session's drift.

**State:** ❌ Missing _(detector exists)_

### A2 — Code↔map freshness in CI

CI regenerates the node set + signatures from code and fails on divergence, not just `bundle≡fragments`. Makes `main` un-stale-able.

**State:** ❌ Missing _(CI only checks `bundle≡fragments`)_

### A3 — Two-parser conformance test

Prove the app parser (`io/mermaid`) and pipeline parser (`mmd-parse.mjs`) produce identical models, or the review shows one thing while enforcement does another.

**State:** ❌ Missing _(untested)_

### A4 — Verification-tier metadata

Every node/edge/desc tagged `verified / advisory / unverified`, with a report that emits "PROVEN vs NARRATED." Lets a fresh Claude calibrate trust instead of swallowing prose-equal-to-signature.

**State:** ❌ Missing

**Outcome:** `flowmap:verify` green ⟺ the map is true + complete as of HEAD, and which claims are load-bearing is explicit.

---

## Phase B — Verifiable onboarding

> 0-context Claude → trusted, verified understanding

### B1 — Single onboarding command (`flowmap:onboard`)

Verifies the map is green, prints the minimal durable invariants (the only trusted prose), points at `_bundle.mmd` + `bodies.json`, runs B2. One door in, verifiable result.

**State:** ❌ Missing

### B2 — Keystone 1: Comprehension self-test

A deterministic question set generated from the verified map:

> _"arity of `applyPlan`? which module implements `hooks.render`? blast radius of state?"_

A fresh Claude answers from the map alone, scored against the map's facts. Passing = understanding demonstrated, not asserted. Wrong answer exposes either a polluted read or an incomplete map.

**State:** ❌ Missing

**Outcome:** "Do you understand the app?" stops being a subjective yes/no and becomes a passing test.

---

## Phase C — Continuity + planning

### C1 — Verified work-state (`flowmap:status <plan>`)

_Scenario 1._ "Where we left off" is structured data keyed to real nodes, but its status is derived, not stored: re-run the gate per change → the system computes `built / approved-but-unbuilt / drifted`. Kills the high-risk prose break point.

**State:** ⚠️ Partial _(pieces — `applyPlan`, `gate` — exist)_

### C2 — Plan authoring + one-command dry-run cert

_Scenario 2._ English → `plan.json` (with proposed fm) + proposed `.mmd`, then a single command runs `apply → stubs → tsc → gate` and certifies the plan round-trips before the human ever opens it.

**State:** ⚠️ Partial _(pieces exist; no integrated "certify a plan" command)_

### C3 — Authoring-time coherence

Plan references only real ids (checked vs fresh map), dependency graph acyclic, accepted set coherent.

**State:** ⚠️ Partial _(`coherenceWarnings` exists for review, not authoring)_

---

## Phase D — Visual review

> Paste into app → diff, blast radius, approve — _"reasonably solid"_

### D1 — Layout fidelity

Render the overlay on the human's real `ctx.state` positions, not the force-sim ball. The canvas is the human layer; this is the one substantive gap here.

**State:** ❌ Missing _(still force-sim)_

### D2 — Unified review surface

`diffWorkspace` and `planner` overlap; collapse to one path: `paste → diff + blast radius + bodies + before/after sigs → accept/reject → export`.

**State:** ⚠️ Partial _(two overlapping UIs)_

---

## Phase E — Approval → implementation → re-sync

### E1 — Single approval export

One artifact: approved `.mmd` + generated stubs/contracts + the gate flipped to `"unbuilt"` = the build checklist.

**State:** ⚠️ Partial _(`serializeSpec`, `spec:stubs` exist as pieces)_

### E2 — Keystone 2: Behavioral acceptance tests in the contract

The approved change carries acceptance criteria that generate failing tests; "done" = signature-gate green AND those tests green. This is what makes implementation verifiably correct, not just correctly-shaped.

**State:** ❌ Missing _(the behavioral frontier)_

### E3 — Writeback

Approved/implemented code updates the fragments automatically (extend `scaffold --backfill/--init` to add new nodes), so the loop closes without the manual fragment edit that caused this session's drift.

**State:** ⚠️ Partial _(`scaffold` exists; writeback manual)_

### E4 — CI enforces the whole loop

A merge can't land unless map is fresh+complete (A1/A2), the approved plan's changes are all gate-green (C1), and acceptance tests pass (E2). "Error-free" becomes a CI property.

**State:** ❌ Missing

---

## Summary

### Already solid — keep

The diff engine + 4 views, the planner overlay, transitive `downstreamCone`, real bodies, coherence checks, `applyPlan` / `serializeSpec`, `spec:stubs`, the signature gate, the fragment→bundle pipeline.

--- below this could be stale ---

# flowmap — orientation for a new contributor (human or AI)

Read this first. It exists so you can work in this repo **without reading every file**.
It holds only the durable mental model — the things you cannot infer from any single file
and that, missed, cause wrong changes. The precise, always-current map of every
module/interface/source lives in the flowmap (see *Navigating* below) and is regenerated
from code, so this file stays short and rarely needs editing.

## Two things live in this repo — do not conflate them
1. **The app** — `src/`. A client-side canvas diagram editor. **Vanilla TypeScript + Vite,
   no framework** (no React/Vue/Svelte). The DOM is built by hand.
2. **The flowmap-spec tooling** — `tools/`. A *separate* dev-time system that turns a repo
   into a reviewable `.mmd` architecture map and lints it (it rejects flat "file-mirror"
   maps). It documents *other* repos — and this one. It is **not** part of the app runtime.
   Entry point: `tools/BUILD_FLOWMAP.md`. This app's own map is `docs/flowmap/_bundle.mmd`.
   `flowmap-scaffold` (`tools/buildspec/scaffold.mjs`) bootstraps draft fragments from TS
   (`--init`) and backfills interface declarations with real types (`--backfill`).
   How it is packaged, how other repos consume it (a local `file:` dependency, by
   design — not copy-paste, not on npm), and the exact publish recipe if that is ever
   needed: `tools/DISTRIBUTION.md`.

Everything below is about **the app**.

## The 3 invariants that explain everything
**1 — `src/main.ts` is the composition root: the ONLY module that imports every other.**
Every module is a factory: `initX(ctx, deps) => api`. `main.ts` (a) builds one `AppContext`,
(b) calls each `initX` in dependency order, (c) wires hooks, (d) binds top-level DOM, (e) boots.
No business logic lives in `main.ts`. **To see how anything connects, read `main.ts` — not the
feature files.**

**2 — Modules NEVER import each other's runtime code. They call `ctx.hooks.<fn>()`.**
`main.ts` assigns the real implementations onto `ctx.hooks` *after* every module is built
(`createHooks()` in `core/context.ts` seeds them with throwing placeholders, so a hook called
before boot throws a clear error). This deliberately breaks import cycles (render → inspector
→ render). So when `pointer.ts` calls `ctx.hooks.render()`, the implementation is in
`render.ts`, wired in `main.ts` step 4 — **there is no direct import to chase; stop looking
for one.** Rule of thumb (from `context.ts`): shared *data* lives on `ctx`; shared *behaviour*
is wired as a hook but defined in its owning module.

**3 — `ctx` (`AppContext`) is the single shared object, passed to every `init`.**
The entire app state is here and nowhere else:
- `ctx.state` — the diagram model (nodes, edges, selection, id counters). **Source of truth.**
- `ctx.cam` · `ctx.prefs` · `ctx.history` · `ctx.clipboard` · `ctx.runtime` — live singletons.
- `ctx.view.container` — current drill-in level (`null` = top level).
- `ctx.bodies` — optional `id → {kind, body}` source map for the inspector's source pane.
- `ctx.hooks` — the cross-module callbacks from invariant 2.

## The data model: state ↔ text
The diagram **is** `ctx.state`. `io/mermaid.ts` is the **only** serialiser: `toMermaid`
(state → text) and `fromMermaid` (text → state). The Mermaid `<textarea>` is a *view* of
state, refreshed by `hooks.sync`. `render/render.ts` reads state → DOM. `io/layout.ts`
("Tidy") rewrites node positions *in state*. User edits go through `interaction/nodes.ts` and
`interaction/selection.ts`, then trigger `hooks.render` + `hooks.sync` + `history.pushHistory`.

## The runtime loop
input (`pointer.ts` / `keyboard.ts`) → verbs mutate `ctx.state` (`nodes.ts` / `selection.ts`)
→ `hooks.render` → `render.ts` paints DOM → `wires.ts` draws edges → `avoidRouter.ts` routes
reference edges off the main thread (`avoidWorker.ts`). Undo = `history.ts` snapshots of state.
Autosave = `persistence.ts` → `localStorage`.

## Folder map (coarse — the precise map is the flowmap)
- `core/` — model + shared seam: `state`, `context` (ctx + hooks), `config` (static data
  tables), `types`, `frontmatter`, `validate`, `camera`, `history`, `persistence`, `runtime`, `seed`.
- `interaction/` — input → model verbs: `pointer`, `nodes`, `selection`, `clipboard`,
  `keyboard`, `inline-edit`, `context-menu`, `view` (drill-in navigation).
- `io/` — text + layout + files: `mermaid` (state↔text), `layout` (Tidy), `export` (SVG/PNG), `files`.
- `panel/` — right-hand UI: `inspector` (+ source pane), `inspector-frontmatter`, `tabs`,
  `style-controls`, `theming`.
- `render/` — drawing: `render` (DOM), `wires` (edges), `avoidRouter` (+ `avoidWorker`), `minimap`.

## Conventions
- Init-factory per module; one `AppContext`; hooks for every cross-module call.
- Theming is CSS variables set from `prefs` by `theming.ts` — don't hard-set colours on nodes.
- `%% ...` comment directives (including `%% src`) belong to the tooling, not the app.

## Navigating without reading every line
- **New agent / 0-context handover**: run `npm run flowmap:onboard` FIRST. It proves the map is
  true+complete as of HEAD, states these invariants, and hands you a comprehension quiz
  (`npm run flowmap:quiz`) that makes your understanding pass/fail instead of prose. Verified work
  state of an in-flight plan: `npm run flowmap:status -- --plan <plan.json>`. (See `docs/flowmap/SESSION_HANDOFF.md`.)
- **Whole architecture + interfaces + source**: open `docs/flowmap/_bundle.mmd` in the app,
  or read `docs/flowmap/root.mmd` — every module carries a one-line `desc` and its interface as
  frontmatter, and the 13 heaviest units are drilled to function level. `public/bodies.json`
  holds the real source per node (regenerate with `npm run flowmap:bodies`).
- **What module X exposes**: its `initX` return type, or its frontmatter in `root.mmd`.
- **How X reaches Y**: it doesn't directly — find the hook in `core/context.ts` and the
  wiring in `main.ts`.
- **Minimum useful read before a change**: `main.ts` (wiring) + `core/context.ts` (the
  `ctx`/`hooks` shape) + the one module you're touching. That is enough.

## Keeping this current (low-maintenance by design)
- This file = **durable patterns only**. Edit it only when an *invariant* changes (rare).
- The **precise** map regenerates from code: `npm run flowmap:ship` (bundle → validate → lint
  → bodies). `flowmap-lint` fails the build if the map ever degrades into a flat file-mirror,
  so the architecture doc cannot silently rot.

## Working rules (non-negotiable) 
- Before writing ANY documentation or making claims about how code works,  READ the actual source files. Never synthesize from narrative docs or memory.
- Batch your reads: read all relevant files in one turn before responding.
- After writing, VERIFY: run the commands you documented, cat the files you  cited. Correct discrepancies before showing the result.
- If you're about to describe a script's behavior, cat package.json and quote it.`


