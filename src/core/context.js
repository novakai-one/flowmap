/* =====================================================================
   context.ts — the wiring seam
   ---------------------------------------------------------------------
   Responsibility: define AppContext, the single object passed to every
   module's init(). It carries:
     • resolved DOM element references,
     • mutable runtime singletons (camera, prefs, history, clipboard),
     • cross-module callback hooks (render, sync, renderInspector, ...).

   Why this exists: the original single file relied on hoisted function
   names referencing each other freely. Splitting into ES modules would
   create import cycles (render → inspector → render). The context object
   breaks every cycle: modules read/write `ctx`, and during boot main.ts
   assigns the real implementations onto the hook fields. No module
   imports another module's runtime function directly.

   Rule of thumb: shared *data* lives here; shared *behaviour* is wired
   here as hooks but defined in the owning module.
   ===================================================================== */
function notWired(name) {
    throw new Error(`Hook "${name}" called before boot wiring completed`);
}
/** Build a context with placeholder hooks; main.ts fills them in. */
export function createHooks() {
    return {
        render: () => notWired('render'),
        sync: () => notWired('sync'),
        renderInspector: () => notWired('renderInspector'),
        drawMinimap: () => notWired('drawMinimap'),
        applyCam: () => notWired('applyCam'),
        persist: () => notWired('persist'),
        pushHistory: () => notWired('pushHistory'),
        updateUndoButtons: () => notWired('updateUndoButtons'),
        toast: () => notWired('toast'),
        showTab: () => notWired('showTab'),
    };
}
