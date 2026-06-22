# Flowmap

A spatial diagram tool for dev work — drag-and-drop flowcharts with two-way
Mermaid sync, themes, an overview minimap, undo/redo, autosave, and SVG/PNG
export. Runs entirely in the browser; no backend.

## Develop

```bash
npm install
npm run dev        # Vite dev server with hot reload
npm run typecheck  # strict tsc, no emit
npm run build      # type-check + production bundle to dist/
npm run preview    # serve the built bundle
```

Open the dev server URL it prints. The app autosaves to `localStorage`, so a
refresh keeps your diagram.

> Why a dev server rather than opening `index.html`? ES modules can't load over
> `file://` (browser CORS). `npm run dev` (or any static server) is required.
> The built `dist/` is fully static and deploys to GitHub Pages as-is.

## Architecture

The model is the single source of truth; the canvas and the Mermaid textarea
both read and write it. Modules are wired through a shared `AppContext` (see
`src/core/context.ts`) rather than importing each other's runtime functions,
which keeps the dependency graph acyclic. `main.ts` is the only module that
knows about all the others — it constructs each one and wires the cross-module
hooks.

```
src/
  core/
    types.ts         shared data shapes (Node, Edge, Prefs, ...)
    config.ts        static tables: shapes, palette, themes, fonts, defaults
    context.ts       AppContext: DOM refs, runtime singletons, hook seam
    state.ts         the model + pure geometry/snap helpers
    runtime.ts       transient flags render reads (editingId, linkSrc)
    camera.ts        pan/zoom transform, screen<->world, zoom-to-fit
    history.ts       undo/redo via model snapshots
    persistence.ts   autosave + prefs in localStorage
    seed.ts          first-run sample diagram
  render/
    render.ts        model -> node DOM, shape markup, status
    wires.ts         edge paths (straight/ortho), hit areas, labels
    minimap.ts       overview canvas + click/drag navigation
  interaction/
    selection.ts     select / toggle / clear / all
    nodes.ts         add / link / delete / align / group
    clipboard.ts     copy / paste / duplicate
    pointer.ts       drag / marquee / pan / resize / port-link
    inline-edit.ts   double-click label editing
    keyboard.ts      shortcuts + wheel pan/zoom
    context-menu.ts  right-click menu
  panel/
    theming.ts       apply theme / font / canvas prefs
    style-controls.ts build + wire the Style tab
    inspector.ts     single / multi / edge property editors
    tabs.ts          panel tabs, collapse, toast
  io/
    mermaid.ts       two-way Mermaid <-> model
    layout.ts        auto-layout (layered tree)
    export.ts        standalone SVG + PNG export
    files.ts         save / load .mmd
  main.ts            composition root: construct, wire hooks, boot
```

### The hook seam

`AppContext.hooks` holds cross-cutting callbacks (`render`, `sync`,
`renderInspector`, `pushHistory`, `toast`, ...). Each module defines its own
behaviour and calls *other* modules' behaviour only through these hooks.
`main.ts` assigns the real implementations after every module is constructed.
This is what lets, say, `nodes.addNode()` trigger a re-render and a history push
without `nodes.ts` importing `render.ts` or `history.ts` directly.

## Persistence keys

- `flowmap.autosave.v1` — the current diagram + camera
- `flowmap.prefs.v1` — theme, font, grid/snap/minimap toggles, default routing
