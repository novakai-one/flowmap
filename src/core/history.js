/* =====================================================================
   history.ts — undo / redo
   ---------------------------------------------------------------------
   Responsibility: maintain a bounded stack of JSON model snapshots and
   provide push / undo / redo / restore. Restoring writes back into the
   model and triggers render + sync + inspector via hooks. It does NOT
   know how rendering works — only that those hooks exist.

   pushHistory() also fires persist() so autosave tracks undo points.
   ===================================================================== */
export function createHistory() {
    return { stack: [], i: -1, max: 80 };
}
export function initHistory(ctx) {
    const { state, history } = ctx;
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    function snapshot() {
        return JSON.stringify({ nodes: state.nodes, edges: state.edges, nid: state.nid, eid: state.eid, dir: state.dir });
    }
    function updateUndoButtons() {
        undoBtn.disabled = history.i <= 0;
        redoBtn.disabled = history.i >= history.stack.length - 1;
    }
    function pushHistory() {
        history.stack = history.stack.slice(0, history.i + 1);
        history.stack.push(snapshot());
        if (history.stack.length > history.max)
            history.stack.shift();
        history.i = history.stack.length - 1;
        updateUndoButtons();
        ctx.hooks.persist();
    }
    function restore(snap) {
        const s = JSON.parse(snap);
        state.nodes = s.nodes;
        state.edges = s.edges;
        state.nid = s.nid;
        state.eid = s.eid;
        state.dir = s.dir || 'TD';
        state.sel.clear();
        state.selEdge = null;
        ctx.hooks.render();
        ctx.hooks.sync();
        ctx.hooks.renderInspector();
    }
    function undo() {
        if (history.i <= 0)
            return;
        history.i--;
        restore(history.stack[history.i]);
        updateUndoButtons();
        ctx.hooks.persist();
        ctx.hooks.toast('Undo');
    }
    function redo() {
        if (history.i >= history.stack.length - 1)
            return;
        history.i++;
        restore(history.stack[history.i]);
        updateUndoButtons();
        ctx.hooks.persist();
        ctx.hooks.toast('Redo');
    }
    return { pushHistory, undo, redo, updateUndoButtons };
}
