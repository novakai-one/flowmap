# Build Plan — Group 1 (Foundation) + Group 3 (Navigation)

Status: proposed
Scope: verified against repo at time of writing. Every claim below was read from source, not assumed.

---

## Ground truth (verified, not guessed)

| Claim | File:evidence | Status |
|---|---|---|
| Backfill glob misses 1- and 2-level fragments | `package.json` → `flowmap:backfill` uses `src/*/*/*.flowmap.mmd` | BUG confirmed |
| Real fragments live at 1, 2, and 3 levels | `src/main.flowmap.mmd`, `src/io/files.flowmap.mmd`, `src/core/state/state.flowmap.mmd` | confirmed |
| `diff-core.mjs` is pure, zero IO, exports `diffSkeletons` | `tools/buildspec/diff-core.mjs` header + export | confirmed |
| Parser ignores unknown `%%` | `mmd-parse.mjs` → `if (/^%%/.test(t)) continue;` | confirmed |
| Parser returns `{dir,roots,nodes,edges,groups,fm}` | `mmd-parse.mjs` `parseMmd` return | confirmed |
| In-app serializer writes whole model only | `io/mermaid.ts toMermaid()`, `mmd-parse.mjs toMmd()` | confirmed (no slice exists) |
| Trace is TYPE-based, not call-spine | `render.ts` `runtime.tracedType` + `trace-hit`/`trace-dim` | confirmed (doc claim was wrong) |
| `ctx.bodies` is `Map<id,{kind,body,accepts,returns}>` | `context.ts` AppContext.bodies | confirmed |
| Source pane reads `ctx.bodies.get(id)` with BARE id | `inspector.ts` `updateSource` | confirmed — id space matches |
| Tabs are static buttons + union type | `tabs.ts` `showTab('insp'|'style'|'mmd'|'source')` | confirmed |
| Camera has `zoomToFit`, no `zoomToNode` | `camera.ts` CameraApi | confirmed (center-on-node is a gap) |
| `ctx.view.container` is drill level; no "home" hook | `context.ts`, `camera.ts` | confirmed |
| State exposes `childIdsOf`, `containerOf`, `containerPath`, `nodeCenter`, `worldBounds` | `state.ts` exports | confirmed |

Correction carried into plan: the doc's "#15 reuses `is-traced` at render.ts:95" is **wrong**. Node dimming uses `trace-hit`/`trace-dim` driven by `runtime.tracedType`. Focus mode reuses that path, not `is-traced` (which is on type chips inside the fm card).

---

## Build order

```
T0  glob fix          (no deps)        — ship first, today
T1  slice-core.mjs    (no deps)        — pure module, CLI + browser
T2  navigator         (reads state)    — parallel with T1
T3  home + root ring  (reads camera)   — parallel
T4  focus mode        (reuses trace)   — after T2 (shares zoomToNode)
T5  continuous gate   (reads bodies)   — after T1 (reuses slice-core diff)
T6  assertions        (extends gate)   — last; only real design work
T7  app shell tab     (extends tabs)   — wraps T2/T5 panes
```

T0–T4 are mechanical, AI-churnable. T6 is the one piece needing your judgment.

---

# GROUP 1 — Foundation

## T0 — Backfill glob fix (#7)

Problem: `src/*/*/*.flowmap.mmd` requires exactly 3 path levels under `src`.
Misses: `src/main.flowmap.mmd` (1), all of `src/io/`, `src/render/`, `src/interaction/`, `src/panel/` (2). Catches only `src/core/*/` (3).

Change: `package.json`

```
"flowmap:backfill": "for f in $(find src -name '*.flowmap.mmd'); do node tools/buildspec/scaffold.mjs --backfill \"$f\" --tsconfig tsconfig.json; done",
```

(`find` is used over a glob because the shell does not expand `**` without globstar.)

Pass/fail:
- Before: `for f in src/*/*/*.flowmap.mmd; do echo $f; done` → only `core/*` files.
- After: same loop with `find` → includes `src/main.flowmap.mmd`, `src/io/files.flowmap.mmd`, `src/render/render.flowmap.mmd`.
- Test: `find src -name '*.flowmap.mmd' | wc -l` equals count of `.flowmap.mmd` files actually present.

Effort: trivial. No AI needed.

---

## T1 — Slice core (#3)

New file: `tools/buildspec/slice-core.mjs`. Pure, zero IO. Reuses `parseMmd`.

API:
```
sliceModel(model, rootIds, opts) -> model'
  // model = parseMmd output
  // rootIds = node ids to slice around
  // opts = { up:bool (ancestors), down:bool (descendants), refs:bool (dotted neighbours) }
  // returns a new {dir,roots,nodes,edges,groups,fm} containing only kept ids + edges between them
```

Algorithm (all data already in `parseMmd` output):
1. seed = rootIds.
2. if `down`: walk `edges` where `style==='solid'`, from→to, collect reachable.
3. if `up`: walk solid edges to→from, collect ancestors.
4. if `refs`: add direct `style==='dotted'` neighbours of seed (1 hop).
5. keep = union. Filter `nodes`, `fm` to keep. Filter `edges` to those with both ends in keep.
6. serialize via existing `toMmd(model')`.

Why pure graph ops: no new concepts. `edges[].style` already distinguishes solid/dotted (`mmd-parse.mjs` EDGE_RE).

Bodies slice (the token-saver): given keep-set, filter `bodies.json` by key. In-app the key is the bare id (verified in inspector). CLI key is `container__symbol` — provide a `keyMode` param so both work.

CLI bin: `flowmap-slice --map _bundle.mmd --node renderFn --down --up --refs --bodies public/bodies.json`

Pass/fail (deterministic):
- Slice of a known node returns the expected id set. Fixture: pick `initCamera`, `--down`, assert output contains its solid-edge children and excludes unrelated containers.
- Token check: serialized slice of one render node + its spine is < 4k tokens vs full bundle. Measure with `wc -c` / 4.
- Round-trip: `parseMmd(toMmd(slice))` equals `slice` (no data lost).
- Edge integrity: no edge in output references an id absent from output.

In-app surface (later, feeds T7): a "Slice" button on selected node → calls same logic on `state` (adapt `state.nodes`/`state.edges` to the `parseMmd` shape, or run on the loaded `.mmd`).

Effort: low. AI-churnable. The fixture is the spec.

---

## T6 — Assertions (#16)  [the hard one — do last]

Two tiers. Tier A is free (data exists). Tier B needs new annotation.

### Tier A — assertions over data already parsed (no new format needed)
Each is a declarative line the gate evaluates against `parseMmd` output:

| Assertion | Data source | Check |
|---|---|---|
| forbidden edge `auth -/-> raw_db` | `edges` | assert no edge from→to matches |
| fan-out ≤ N on node X | `edges` filter from===X | count ≤ N |
| state count ≤ N on node X | `fm[X].state.length` | ≤ N |
| change-boundary: only ids {…} may differ | diff two bundles via `diffSkeletons` | changed set ⊆ allowed |
| solid-edge subgraph acyclic | `edges` style==='solid' | DFS, no back-edge |

### Tier B — needs new model data (honest gap)
- "node must not trigger re-render of X" — flowmap models no effects. New annotation `%% assert <id> no-rerender <target>` required. Not free. Defer or scope out.

### Design work (this is the part AI cannot just churn)
1. Assertion grammar: where do they live? Proposal: `%% assert <kind> <args>` lines in the `.mmd`, ignored by `parseMmd` (already skips unknown `%%`), read by a new `parseAssertions(text)`.
2. Lifecycle: authored in app → exported in sliced contract → run by gate pre-merge.
3. Gate integration: extend `gate.mjs` to load assertions, run them after `diffSkeletons`, emit pass/fail per assertion.

Pass/fail (end-to-end, the real proof):
- Author `%% assert forbidden-edge auth raw_db`.
- Add edge `auth --> raw_db` to code-side extract.
- Run gate → exits non-zero, names the violated assertion.
- Remove edge → gate exits zero.

Effort: Tier A medium, Tier B high. Tier A is the shippable unit. Decide grammar before writing — that decision is yours, not the AI's.

---

# GROUP 3 — Navigation

## T2 — Node navigator (#4)

New file: `src/panel/navigator.ts`. New pane in `index.html` + tab.

Reads only: `ctx.state.nodes`, `ctx.state.edges`, existing state helpers.
Writes: selection (via `SelectionApi`), camera (new `zoomToNode`, see T2.1).

UI: searchable list. Each row = node id + kind badge + container label.
Filters (all pure on `state.nodes`):
- by kind: `n.kind === k`
- by container: `containerOf(state, id) === c`
- by edge participation: `edges.some(e => e.from===id || e.to===id)`

Row click → `selection.selectOnly(id)` + `zoomToNode(id)` + render.

### T2.1 — `zoomToNode(id)` (camera gap)
`camera.ts` has `zoomToFit` (level bounds) but nothing centres one node. Add:
```
zoomToNode(id): center cam on nodeCenter(state.nodes[id]) at current or fixed zoom, applyCam()
```
Reuses `nodeCenter` (state.ts) + the cam math already in `zoomAt`.

Pass/fail:
- Filter "function" → list length === count of nodes with `kind==='function'` in state.
- Click row → that id is the sole member of `state.sel`, and `nodeCenter` maps to viewport centre (within pad).
- Search "camera" → only ids/labels containing "camera" shown.

Effort: low-med. ~150 lines. AI-churnable once `zoomToNode` exists.

---

## T3 — Home + root ring (#6)

Home: new hook or direct call — `ctx.view.container = null; ctx.hooks.render(); zoomToFit()`.
There is no existing "go to root"; `enterContainer` only drills *in*. This is the inverse.

Add a `goHome()` (in camera or a small nav module) + a `⌂` toolbar button wired like the existing `panelBtn` in `tabs.ts`.

Root ring: in `render.ts classFor`, append `' is-root'` when `id` is in `state.roots`. Add CSS `.node.is-root { outline: ... }`.

Pass/fail:
- Drill into a container (`view.container !== null`), click Home → `view.container === null` and camera frames root bounds (`worldBounds`).
- A node whose id is in `state.roots` renders with the ring class; others do not.

Effort: low. Subsumes the navigator's "root at top" once T2 lands.

---

## T4 — Focus mode (#15)

Click node → dim everything except its call spine. Reuses the **trace-dim path**, not `is-traced`.

Mechanism (verified): `render.ts classFor` already applies `trace-hit` / `trace-dim` based on `runtime.tracedType`. Add a parallel transient: `runtime.focusSpine: Set<string> | null` in `runtime.ts`.

In `classFor`, when `focusSpine` is set:
- `focusSpine.has(id)` → `' focus-hit'`
- else → `' focus-dim'`

Spine computation = T1 slice logic restricted to solid ancestors+descendants + dotted neighbours of the clicked id (reuse `slice-core` keep-set; no second implementation).

Toggle: click node with a modifier (or a "Focus" inspector button) sets `focusSpine`; click empty / Esc clears it.

Pass/fail:
- Click node X → every id in X's solid spine has `focus-hit`, every other rendered id has `focus-dim`.
- Clear → no node carries focus classes.
- Spine set equals `sliceModel(model,[X],{up,down,refs}).nodes` keys.

Effort: low. ~50 lines render + reuse of T1. Depends on T1 keep-set.

---

## T5 — Continuous in-browser gate (#14)

When `ctx.bodies` is loaded, both sides are in memory:
- spec side: `state.nodes[id].fm.interfaces` (declared accepts/returns)
- code side: `ctx.bodies.get(id)` → `{accepts, returns}`

Key space matches (verified: inspector reads `ctx.bodies.get(id)` with bare id).

Port the comparison only (not full `diffSkeletons` — that needs skeleton maps). New `src/core/drift/drift.ts`:
```
checkDrift(state, bodies) -> { inSync:number, total:number, drift:[{id, reason}] }
  for each id in bodies:
    declared = state.nodes[id]?.fm.interfaces[0]
    real = bodies.get(id)
    compare arity (declared.accepts.length vs real.accepts.length)
    compare return-ness (declared.returns non-empty vs real.returns != null)
```

Live badge in status bar: `✓ 250/250 in sync` or `⚠ 3 drift`.

Note: this is a lighter check than the CLI gate (arity + return only, no kind/parent). State it as such; it is a fast smoke signal, not the authoritative gate.

Pass/fail:
- Load matching bundle + bodies → badge shows `total/total`, drift empty.
- Hand-edit one node's `fm` accepts to add a phantom param → badge shows 1 drift naming that id.
- Remove bodies → badge hidden (no false green).

Effort: low-med. Pure compare, no IO beyond the already-loaded map.

---

## T7 — App shell tab (#17)

`tabs.ts` already switches panes via a union + static buttons. Extend, don't rebuild.

1. Add `'nav'` (and later `'review'`) to the `showTab` union in `tabs.ts` and `context.ts` Hooks.
2. Add `tabNav` button + `paneNav` div in `index.html`, mirroring `tabSource`/`paneSource`.
3. Branch in `showTab`: toggle active + display, call `navigator.render()`.

Pass/fail:
- Click Nav tab → `paneNav` visible, others hidden, `tabNav` active.
- Type-check passes with extended union (every `showTab` call site covers `'nav'`).

Effort: med. Pure plumbing once T2 exists.

---

## What this plan deliberately does NOT claim

- It does not reuse `is-traced` for focus mode (doc was wrong; uses `trace-hit/dim`).
- It does not assume bundle ids === bodies `__` ids in the CLI — slice-core takes a `keyMode`.
- Continuous gate (#14) is arity+return only, not the full structural gate. Not overstated.
- Assertions Tier B (re-render effects) is flagged as a real gap, not a freebie.

## Recommended cut for a first shippable slice
T0 (today) → T1 + T2.1 + T2 (the navigator is the highest daily-use payoff and unlocks T4) → T3 → T4. Defer T5/T6/T7 until the navigation loop feels right in hand.
