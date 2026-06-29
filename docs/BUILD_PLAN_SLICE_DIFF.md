# Build Plan — Slice view + Diff view

Two user-facing features, grounded in the real code (signatures + line numbers read from source 2026-06-29, post-commit `599f658`).

- **F1 — Slice view**: click a node → see a self-contained `.mmd` of only that node's neighbourhood (children + parents + connected siblings), with a Copy button. Goal: copy it out, hand to Claude, paste a drop-in replacement back.
- **F2 — Diff view**: paste/load a *before* `.mmd` and an *after* `.mmd`; render both and highlight what changed. Goal: see exactly what a Claude-returned replacement altered before applying it.

No code is written until this plan is approved.

---

## Ground truth (verified, not guessed)

Read from source before writing this plan:

- `src/io/mermaid.ts:150` — `toMermaid()` takes **no parameter**. It closes over `state.nodes`/`state.edges` and always serializes the **whole** diagram. Emits `%% fm`, `%% kind`, `%% parent`, `%% root`, frontmatter, subgraphs, then edges. This is the single serializer (CLAUDE.md invariant: `io/mermaid.ts` is the ONLY serialiser).
- `src/io/mermaid.ts:50` — `fromMermaid(text): ParseResult` is the only parser. Returns `{ nodes, edges, nextN, nextE, dir, roots }`.
- `src/interaction/pointer.ts:73` — `computeFocusSpine(id): Set<string>` already computes the exact keep-set we need (solid up+down transitive, dotted 1-hop). It is **private to the pointer closure** and operates on `ctx.state.edges`.
- `src/core/types/types.ts:77` — `DiagramEdge { id, from, to, label, style, routing, ... }`, `style: EdgeStyle = 'solid'|'dotted'|'thick'`.
- `src/panel/tabs.ts:21` — `showTab(which: 'insp'|'style'|'mmd'|'source'|'nav')`. Adding a tab = extend this union + add pane/foot toggles + bind the tab button + (optionally) a `hooks.renderX` call. (Navigator already did this exactly — use it as the template.)
- `src/panel/inspector.ts:53` — source pane = `#sourceEmpty` + `#sourceBody`, gated on single-node selection + `ctx.bodies` entry.
- `tools/buildspec/slice-core.mjs` — `sliceModel/filterBodies/sliceToMmd` exist but operate on the `parseMmd` bundle model, **not** `ctx.state`. Per CLAUDE.md, `src/` must NOT import `tools/`. We reuse the *algorithm*, not the module.

### The one refactor both features need

`toMermaid()` cannot currently emit a subset. **F1 requires serializing only the kept ids.** So step 1 is a small, behaviour-preserving refactor:

```
toMermaid(): string                       // existing public API — unchanged behaviour
  → toMermaid(opts?: { only?: Set<string> }): string
```

When `opts.only` is absent, output is **byte-identical** to today (this is the drift gate for the refactor). When present, every `for (const id in state.nodes)` loop and every edge loop skips ids not in `only`. Edges are kept only when **both** endpoints are in `only` (matches `sliceModel` semantics). This keeps one serializer (invariant intact) and adds slice capability without a second code path.

---

## Build order

```
S0  refactor toMermaid(only?)        — no deps; pure refactor, byte-identical default   [F1+F2 foundation]
S1  app-side sliceIds(id)            — extract computeFocusSpine into a shared helper    [F1]
S2  slice pane + Copy button         — new 'slice' tab; reuses S0+S1                     [F1]
F1 SHIPPABLE HERE
D0  diff-core app port               — src/core/diff/diff.ts: compare two ParseResults   [F2]
D1  diff pane (two textareas + render)— new 'diff' tab; paste before/after              [F2]
D2  change highlighting              — colour added/removed/changed nodes & edges        [F2]
F2 SHIPPABLE HERE
```

S0–S2 ship F1 independently. D0–D2 ship F2. Each step has a before/after drift check.

---

# F1 — Slice view

## S0 — Refactor `toMermaid` to accept an id filter

**File:** `src/io/mermaid.ts`

**Change:** `function toMermaid(): string` → `function toMermaid(opts: { only?: Set<string> } = {}): string`. Add at top: `const keep = opts.only; const inc = (id: string) => !keep || keep.has(id);`. Guard every `state.nodes` loop with `if (!inc(id)) continue;`. For edges: `if (!inc(e.from) || !inc(e.to)) continue;`. For `%% root`/`%% parent` lines, also guard on `inc`. Update `MermaidApi.toMermaid` signature in the interface and the `sync()` caller (which calls `toMermaid()` with no args — still valid).

**Why drift-safe:** default path (`only` undefined) changes nothing.

### Test — S0 (refactor must not drift the full-document output)

**Setup:** load the app's own bundle as a diagram (or any saved `.mmd`).

| Before (current `toMermaid()`) | After (`toMermaid()` no args) |
|---|---|
| Full mmd string, e.g. starts `flowchart TD\n%% fm main ...` and contains all N nodes + all E edges | **Byte-identical** to Before |

**Drift gate (automated):** add `tools/buildspec/slice-mermaid.test.mjs` or extend an existing test:
```
const full = toMermaid();
assert.equal(toMermaid({}), full);               // empty opts === no opts
assert.equal(toMermaid({ only: undefined }), full);
```
PASS = `toMermaid({}) === toMermaid()`. Any inequality = refactor drifted; revert.

**Slice correctness check (same test file):**
```
const only = new Set(['render', ...connectedIds]);
const sliced = toMermaid({ only });
assert.ok(sliced.startsWith('flowchart'));
assert.ok(!sliced.includes(' someUnconnectedNode '));  // excluded node absent
// every edge line's endpoints are both in `only`
```

---

## S1 — Shared `sliceIds(state, id)` helper

**Problem:** `computeFocusSpine` (pointer.ts:73) is the algorithm we need, but it's trapped in the pointer closure.

**Change:** move the pure keep-set logic to `src/core/state/state.ts` as `export function sliceIds(state: StateStore, id: string): Set<string>` (no DOM, no deps — pure). Then `computeFocusSpine` in pointer.ts becomes `const computeFocusSpine = (id: string) => sliceIds(state, id);`. This de-duplicates and gives F1 a clean import that does NOT cross the app/tooling boundary.

### Test — S1 (extraction must not change focus-mode behaviour)

| Before (alt-click `render` today) | After (alt-click `render`) |
|---|---|
| Spine set highlighted = `{render}` ∪ solid-up ∪ solid-down ∪ dotted-1hop | **Same set**, identical highlight/dim |

**Drift gate:** unit test `sliceIds(state,'X')` against a fixture with a known graph; assert exact Set membership. Also assert `sliceIds` output === old inlined `computeFocusSpine` output on the real bundle (snapshot the id list).

Fixture expectation (concrete):
```
nodes: A,B,C,D,E ; edges: A-solid->B, B-solid->C, A-dotted->D, X-solid->A, E (isolated)
sliceIds(state,'A') === {A, B, C, D, X}   // down:B,C ; up:X ; dotted:D ; NOT E
```

---

## S2 — Slice pane + Copy button

**Files:** `index.html`, `src/panel/tabs.ts`, `src/core/context/context.ts`, `src/main.ts`, new `src/panel/slice.ts`, `css/styles.css`.

Mirror the **navigator** wiring exactly (it's the proven template):

1. `context.ts`: extend `showTab` union to include `'slice'`; add hook `renderSlice: () => void` (seeded with `notWired`).
2. `tabs.ts`: add `slice` to the union (2 spots), toggle `#tabSlice`/`#paneSlice`, bind `$('tabSlice').onclick`, call `ctx.hooks.renderSlice()` when shown.
3. `index.html`: `<button id="tabSlice">slice</button>` + `<div class="ppane slice-pane" id="paneSlice" style="display:none">…</div>` containing a `<textarea id="sliceOut" readonly>` and `<button id="sliceCopy">Copy</button>`.
4. `slice.ts` (`initSlice(ctx, { mermaid }) => { render }`): on `render()`, read the **single selected node** (`state.sel`); if exactly one, compute `sliceIds(state, id)` and set `sliceOut.value = mermaid.toMermaid({ only })`; else show "Select one node to slice." Copy button → `navigator.clipboard.writeText(sliceOut.value)` + toast.
5. `main.ts`: `const sliceMod = initSlice(ctx, { mermaid });` then `ctx.hooks.renderSlice = sliceMod.render;`. Also call `renderSlice` from selection-change (or lazily when the tab is shown — simplest: only on tab show, matching navigator).
6. `css`: `.slice-pane { flex-direction: column; }`, textarea fills, mono font.

### Test — S2 (the actual feature)

**Manual acceptance:** select node `render`, open **slice** tab.

| Before (today) | After (this build) |
|---|---|
| No "slice" tab exists. Mermaid tab shows the **entire** document. | "slice" tab present. With `render` selected, `#sliceOut` shows `flowchart TD` + only `render` and its connected nodes/edges. Copy button copies that text. |

**Concrete expected (using S1 fixture, select `A`):**
```
flowchart TD
%% fm A ... (and B,C,D,X only — NOT E)
  A[...] ; B[...] ; C[...] ; D[...] ; X[...]
  A --> B
  B --> C
  X --> A
  A -.-> D
```
**Drift gate (automated):** `toMermaid({ only: sliceIds(state,'A') })` — assert output contains node lines for A,B,C,D,X and **no** line containing ` E[` or ` E ` as an endpoint; assert every `-->`/`-.->` line has both endpoints in the keep set.

### Known boundary decision (call out, don't silently pick)

A slice around `render` drops edges to outside nodes. For Claude to return a *paste-able replacement*, decide one of:
- **(a) Closed slice** (default, simplest): only fully-internal edges. Claude sees the neighbourhood but not what it connects to outside. Replacement is pasted via the Mermaid tab's existing apply.
- **(b) Boundary stubs:** include 1-hop outside nodes as read-only markers so Claude preserves the seams.

Plan ships **(a)** first (matches `sliceModel`). (b) is a follow-up if seams get lost in practice. **This is a product decision — confirm before S2.**

---

# F2 — Diff view

## D0 — App-side diff (`src/core/diff/diff.ts`)

**Do NOT import `tools/buildspec/diff-core.mjs`** (app/tooling split). Port the comparison only.

**New:** `src/core/diff/diff.ts`, pure, no DOM:
```
export interface MmdDiff {
  addedNodes: string[]; removedNodes: string[];
  changedNodes: string[];   // same id, different label/kind/shape/fm
  addedEdges: string[]; removedEdges: string[];  // by "from->to:style" key
}
export function diffModels(before: ParseResult, after: ParseResult): MmdDiff
```
Compare node id sets for add/remove; for shared ids compare `label`,`kind`,`shape`, and a stable `fm` stringify for `changedNodes`. Edges compared by `from->to` key (+style).

### Test — D0

Fixture before/after pair; assert exact arrays.
```
before: A,B ; A-->B
after:  A,B,C ; A-->B ; B-->C ; (A.label changed)
diffModels(before,after) === {
  addedNodes:['C'], removedNodes:[], changedNodes:['A'],
  addedEdges:['B->C:solid'], removedEdges:[]
}
```
PASS = deep-equal to expected. This is the drift anchor for D0.

## D1 — Diff pane (paste before/after)

**Files:** same wiring pattern as S2. New tab `'diff'`, pane with **two textareas** (`#diffBefore`, `#diffAfter`), a **Render** button, and an output area `#diffView`.

`initDiff(ctx, { mermaid })`: on Render, `fromMermaid(beforeText)` + `fromMermaid(afterText)` → `diffModels(...)` → render a summary list (added/removed/changed) into `#diffView`. Errors (unparseable) → toast "Parse error in before/after".

### Test — D1

| Before (today) | After |
|---|---|
| No diff tab. No way to compare two mmd in app. | "diff" tab; paste two docs, click Render → list: "Added: C", "Changed: A", "Added edge: B→C". |

**Drift gate:** paste the D0 fixture pair; assert `#diffView` text contains `Added: C`, `Changed: A`, `Added edge: B→C` and not `Removed:`.

## D2 — Visual change highlighting (optional polish)

Render the *after* graph (reuse render path on a throwaway state, or just annotate the textarea lines) with added=green, removed=strikethrough/red, changed=amber. Lowest-risk version: colour the lines in `#diffView` only — no canvas changes. Canvas-overlay highlighting is a stretch goal; defer unless the list view proves insufficient.

### Test — D2

Visual: added node label green, removed red, changed amber in `#diffView`. Snapshot the produced HTML class names: `assert diffView.innerHTML includes 'diff-added'` for C, `'diff-changed'` for A.

---

## Per-step gate (run after every S/D step)

```
npm run typecheck                                 # exit 0
npm run flowmap:bundle && npm run flowmap:validate && npm run flowmap:lint   # PASS
node --test tools/buildspec/*.test.mjs            # all green (incl. new slice/diff tests)
git diff --stat                                   # only the files named in that step
```
Plus `spec:gate` once (extract to a **writable** path, not `/tmp` — the sandbox can't overwrite a prior `/tmp/extracted.mmd`):
```
node tools/buildspec/extract.mjs --map docs/flowmap/_bundle.mmd --tsconfig tsconfig.json --out ./_extracted.mmd
node tools/buildspec/gate.mjs --spec docs/flowmap/_bundle.mmd --code ./_extracted.mmd --unplanned-as-warning   # "✓ spec and code are in sync"
```

## What this plan deliberately does NOT do

- Does not import `tools/` from `src/` (CLAUDE.md invariant). Reuses algorithms by porting, matching the precedent set by T4/focus-mode.
- Does not add a second serializer. `toMermaid(only?)` stays the single serialiser.
- Does not auto-apply Claude's returned replacement. Paste-back uses the existing Mermaid-tab apply path. (Auto-splice of a slice back into full state is a separate, riskier feature — explicitly out of scope.)
- S0's default output must stay byte-identical — that equality test is the canary for the whole refactor.

## Files touched (summary)

**F1:** `src/io/mermaid.ts` (S0), `src/core/state/state.ts` + `src/interaction/pointer.ts` (S1), `index.html` + `src/panel/tabs.ts` + `src/core/context/context.ts` + `src/main.ts` + `src/panel/slice.ts` + `css/styles.css` (S2), new test file.
**F2:** `src/core/diff/diff.ts` + test (D0), `index.html` + `tabs.ts` + `context.ts` + `main.ts` + `src/panel/diff.ts` + `css` (D1/D2).

## Open decisions (confirm before build)

1. **Slice boundary:** closed slice (a) vs boundary stubs (b). Plan defaults to (a).
2. **Slice trigger:** on node selection auto-refresh, or only when the slice tab is open? Plan defaults to on-tab-show (cheapest, matches navigator).
3. **Diff input:** two manual textareas (planned) vs one side auto-filled from current document. Plan defaults to two manual paste areas.
