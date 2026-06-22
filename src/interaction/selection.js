/* =====================================================================
   selection.ts — selection operations
   ---------------------------------------------------------------------
   Responsibility: the user-facing selection verbs (selectOnly, toggleSel,
   selectEdge, clearSel, selectAll). Each mutates state.sel / state.selEdge
   then triggers render + inspector so the UI reflects the change. These
   compose the pure model with the render/inspector hooks.
   ===================================================================== */
export function initSelection(ctx) {
    const { state } = ctx;
    function selectOnly(id) {
        state.sel.clear();
        if (id)
            state.sel.add(id);
        state.selEdge = null;
        ctx.hooks.render();
        ctx.hooks.renderInspector();
    }
    function toggleSel(id) {
        if (state.sel.has(id))
            state.sel.delete(id);
        else
            state.sel.add(id);
        state.selEdge = null;
        ctx.hooks.render();
        ctx.hooks.renderInspector();
    }
    function selectEdge(eid) {
        state.sel.clear();
        state.selEdge = eid;
        ctx.hooks.render();
        ctx.hooks.renderInspector();
        ctx.hooks.showTab('insp');
    }
    function clearSel() {
        state.sel.clear();
        state.selEdge = null;
        ctx.hooks.render();
        ctx.hooks.renderInspector();
    }
    function selectAll() {
        state.sel = new Set(Object.keys(state.nodes));
        state.selEdge = null;
        ctx.hooks.render();
        ctx.hooks.renderInspector();
    }
    return { selectOnly, toggleSel, selectEdge, clearSel, selectAll };
}
