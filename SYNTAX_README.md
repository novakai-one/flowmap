# Flowmap `.mmd` format — authoring spec

Hand this file to an LLM (or a teammate) along with a codebase and ask them to
produce a Flowmap diagram. The output is a single `.mmd` text file that
Flowmap's **Load** button (or the Mermaid tab → *Apply text → canvas*) reads
directly. It is valid Mermaid `flowchart` syntax plus a few `%%` comment lines
that Mermaid ignores but Flowmap understands.

> **The one rule that matters:** every extra line Flowmap reads starts with
> `%%`, so the file is still a legal Mermaid diagram. If you only know plain
> Mermaid, you can write a working file with zero `%%` lines — Flowmap will
> auto-place the nodes. The `%%` lines just let you pin positions and attach a
> component's public interface.

---

## 1. Minimum viable file

```
flowchart TD
  app["WorkspaceArea"]
  store[("Zustand store")]
  app --> store
```

That's a complete, loadable file. Nodes get auto-laid-out on a grid. Everything
below is optional enrichment.

---

## 2. Document skeleton

A full file has four kinds of line, in this order:

```
flowchart TD                ← required header; TD top-down, also BT, LR, RL
%% fm <layout lines>        ← optional: node position/size/shape/colour
%% fm:meta <frontmatter>    ← optional: a node's public interface
%% edge <id> ortho          ← optional: mark an edge as right-angle routed
<node + edge definitions>   ← the diagram body (plain Mermaid)
```

The `%%` blocks may appear in any order relative to each other, but keep them
above the body for readability. Put the body last.

**Direction.** The header direction drives Flowmap's *Tidy* auto-layout:
`TD` stacks layers downward, `BT` upward, `LR` left-to-right, `RL`
right-to-left. Pick the direction that reads best for the graph — `LR`
suits wide dependency chains, `TD` suits shallow trees. Tidy spaces every
node by its rendered size (including its frontmatter card), so layers
never overlap regardless of node count.

---

## 3. Node IDs

- IDs are short tokens matching `[A-Za-z0-9_]+` (letters, digits, underscore).
- Flowmap's own editor names them `n1`, `n2`, … but **you should use meaningful
  IDs** when authoring by hand: `dragManager`, `store`, `apiClient`. Readable
  IDs make the `%% fm:meta` lines self-documenting.
- One ID = one node. Reusing an ID refers to the same node.

---

## 4. Node shapes

Pick the shape by what the component *is*. Syntax is standard Mermaid; the label
goes in quotes.

| Shape | Meaning (suggested) | Syntax |
|---|---|---|
| `rect` | module / class / file | `id["Label"]` |
| `round` | process / function | `id("Label")` |
| `stadium` | entry / exit point | `id(["Label"])` |
| `cylinder` | store / database / cache | `id[("Label")]` |
| `diamond` | decision / branch | `id{"Label"}` |
| `circle` | state / event | `id(("Label"))` |
| `hex` | service / external system | `id{{"Label"}}` |
| `note` | annotation / aside | `id>"Label"]` |
| `group` | container (see §7) | `subgraph id ["Label"]` … `end` |

Always quote labels. Keep a label to a few words — detail belongs in frontmatter
(§6), not the label.

```
api{{"PaymentService"}}
isPaid{"Paid?"}
queue[("jobs queue")]
```

---

## 5. Edges

```
a --> b                 solid arrow
a -.-> b                dotted arrow
a ==> b                 thick arrow
a -->|"label"| b        arrow with a label
a -.->|"writes"| b      dotted + label
a ==>|"emits"| b        thick + label
```

- Edge **labels** are the verbs of your system: `routes event`, `reads`,
  `writes`, `calls`, `returns to`. They make the diagram a sentence.
- Direction matters: `a --> b` means a depends on / sends to b.
- By default edges are straight. To make one route as a right-angle elbow, add a
  matching marker line (you must give the edge a stable id — see §8):

```
%% edge e1 ortho
```

If you're authoring by hand and don't care about routing, skip the `%% edge`
lines entirely; everything defaults to straight.

---

## 6. Frontmatter — a node's public interface

This is the payload most worth extracting from code. Frontmatter has two
levels: **node-level** fields and **per-interface** fields.

Node-level — each appears as its own line:

```
%% fm:meta <id> name=<value>
%% fm:meta <id> desc=<value>
%% fm:meta <id> state=<value>
```

Per-interface — a node may expose several interfaces, numbered `i0`, `i1`, …
Each interface owns its own name, accepts, and returns:

```
%% fm:meta <id> i<N>.name=<value>
%% fm:meta <id> i<N>.accepts=<value>
%% fm:meta <id> i<N>.returns=<value>
```

Rules:

- **`name`** and **`desc`** appear at most once per node. `name` is the
  canonical identifier (often the class/function name); `desc` is one sentence
  on what it does.
- **`state`** is node-level and *repeatable* — emit one line per item.
- **Interfaces** are numbered from `0`. Each interface's `name` appears at most
  once; its `accepts` and `returns` are *repeatable* (one line per item). This
  is how you surface multiple distinct entry points, each with its own inputs
  and outputs:

```
%% fm:meta store name=Zustand store
%% fm:meta store desc=central app state, single source of truth
%% fm:meta store state=count: number
%% fm:meta store state=user: User | null
%% fm:meta store i0.name=dispatch
%% fm:meta store i0.accepts=action: Action
%% fm:meta store i0.returns=void
%% fm:meta store i1.name=select
%% fm:meta store i1.accepts=key: string
%% fm:meta store i1.returns=Snapshot
```

- A value is everything after the first `=` up to the end of the line. It may
  contain spaces, colons, pipes, commas — anything except a newline. Do **not**
  quote it.
- Map the fields from code like this:
  - `name` → the symbol's declared name.
  - `desc` → its doc comment / one-line purpose.
  - `state` → fields/instance variables it owns (the stateful surface).
  - `i<N>.name` → the name of one public method / entry point / message.
  - `i<N>.accepts` → that interface's parameters / props / the messages it
    handles.
  - `i<N>.returns` → that interface's return type(s) / what it emits.
- A node with a single interface can leave `i0.name` blank and just emit
  `i0.accepts` / `i0.returns`.
- **Legacy:** bare `accepts=` / `returns=` lines (no `i<N>.` prefix) are still
  parsed and folded into interface `0`. Prefer the prefixed form when authoring.
- Omit any field that doesn't apply. A node with no `%% fm:meta` lines simply has
  no frontmatter (valid and common).

> Frontmatter is visibility-toggled in the app (Style tab → "Frontmatter
> cards") but is **always kept** in the file. Write it whether or not the reader
> currently displays it.

---

## 7. Groups (containers)

A group visually wraps related nodes. Declare it as a Mermaid `subgraph`; list
the child node definitions between `subgraph` and `end`:

```
subgraph domain ["Domain layer"]
  store[("app store")]
  reducer("rootReducer")
end
```

- The group itself can carry frontmatter too (`%% fm:meta domain desc=…`).
- Nodes not inside any `subgraph` are top-level.
- Edges may cross group boundaries freely; declare them in the body (§5), not
  inside the `subgraph`.

---

## 8. Layout metadata (positions) — optional

If you want to pin exact positions instead of auto-layout, add one line per
node:

```
%% fm <id> <x> <y> <w> <h> <shape> <color>
```

- `x y w h` are integers (canvas pixels; top-left origin, y grows downward).
- `<shape>` is one of the §4 keys (`rect`, `round`, …).
- `<color>` is a hex value like `#262c4a`, or the literal `null` for the theme
  default.
- Edge ids referenced by `%% edge` lines (§5) come from the body order; if you
  hand-author and want ortho routing, the simplest path is to let Flowmap
  assign ids: load the file, set routing in the UI, then re-export.

**For LLM/codebase conversion, you normally omit `%% fm` lines entirely** and
let Flowmap auto-place. Positions are a polish step done in the editor, not
something to compute from source. Spend the effort on shapes, edges, and
frontmatter instead.

---

## 9. Escaping

- Inside a **label** (quoted), replace any `"` with `'` and collapse newlines to
  spaces. Labels can't span lines.
- Inside a **frontmatter value**, no escaping is needed except that it must stay
  on one line. `<`, `>`, `&`, `|`, `:` are all fine as-is.
- Don't put `%%` inside a label or value — it only has meaning at the start of a
  line.

---

## 10. Conversion checklist (for an LLM reading a codebase)

When asked to convert a codebase to this format, follow this procedure:

1. **Identify the units.** One node per meaningful unit — module, class,
   service, store, major function. Don't make a node per line; aim for the
   architecture, ~5–40 nodes.
2. **Choose IDs.** Short, readable, unique, `[A-Za-z0-9_]+`. Prefer the symbol
   name lowercased (`paymentService`).
3. **Choose shapes** per §4 from what each unit is.
4. **Draw edges** for real dependencies — imports, calls, data flow, events.
   Label them with the verb of the relationship.
5. **Attach frontmatter** (§6) for every node where you can read a public
   interface: name, one-line desc, owned state, then one numbered interface per
   entry point with its accepts/returns. Use a single interface (`i0`) for
   simple nodes; add `i1`, `i2`, … for components with several distinct methods.
6. **Group** (§7) by layer/domain/folder where it clarifies.
7. **Skip positions** (§8) — let Flowmap auto-lay-out.
8. Emit the header with a chosen direction (`flowchart TD` / `LR` / `BT` /
   `RL`), then the `%%` metadata, then the body. Output only the `.mmd`
   text, nothing else.

---

## 11. Full worked example

```
flowchart TD
%% fm:meta workspace name=WorkspaceArea
%% fm:meta workspace desc=root canvas surface; routes pointer events
%% fm:meta workspace i0.name=onPointer
%% fm:meta workspace i0.accepts=PointerEvent
%% fm:meta workspace i0.returns=void
%% fm:meta drag name=DragManager
%% fm:meta drag desc=tracks an in-progress drag and commits it
%% fm:meta drag state=active: DragItem | null
%% fm:meta drag i0.name=start
%% fm:meta drag i0.accepts=id: string
%% fm:meta drag i0.returns=void
%% fm:meta drag i1.name=move
%% fm:meta drag i1.accepts=point: Point
%% fm:meta drag i1.returns=void
%% fm:meta drag i2.name=commit
%% fm:meta drag i2.returns=void
%% fm:meta store name=Store
%% fm:meta store desc=single source of truth for the diagram model
%% fm:meta store state=nodes: Record<string, Node>
%% fm:meta store state=edges: Edge[]
%% fm:meta store i0.name=patch
%% fm:meta store i0.accepts=p: Partial<State>
%% fm:meta store i0.returns=void
%% fm:meta store i1.name=snapshot
%% fm:meta store i1.returns=State
  workspace["WorkspaceArea"]
  drag("DragManager")
  isDragging{"Dragging?"}
  store[("Store")]
  tiles(["render tiles"])
  workspace -->|"routes event"| drag
  drag -.->|"checks"| isDragging
  drag -->|"writes"| store
  store -->|"reads"| tiles
```

Load that into Flowmap and you get five shaped nodes, four labelled edges, and a
public-interface card under each node when frontmatter display is on.