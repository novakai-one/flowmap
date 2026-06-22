/* =====================================================================
   clipboard.ts — copy / paste / duplicate
   ---------------------------------------------------------------------
   Responsibility: hold the in-memory clipboard and implement copySel,
   pasteClip (with id remapping + optional cursor anchoring) and
   duplicateSel. Mutates the model, re-renders, pushes history.
   ===================================================================== */
import { snapV } from '../core/state';
export function initClipboard(ctx) {
    const { state } = ctx;
    function copySel() {
        if (!state.sel.size)
            return;
        const nodes = [...state.sel].map((id) => ({ ...state.nodes[id] }));
        const idset = new Set(state.sel);
        const edges = state.edges
            .filter((e) => idset.has(e.from) && idset.has(e.to))
            .map((e) => ({ ...e }));
        ctx.clipboard = { nodes, edges };
        ctx.hooks.toast(`Copied ${nodes.length}`);
    }
    function pasteClip(atWorld) {
        const clip = ctx.clipboard;
        if (!clip.nodes.length)
            return;
        const map = {};
        const off = 24;
        state.sel.clear();
        state.selEdge = null;
        let dx = off, dy = off;
        if (atWorld) {
            const minX = Math.min(...clip.nodes.map((n) => n.x));
            const minY = Math.min(...clip.nodes.map((n) => n.y));
            dx = snapV(atWorld.x, ctx.snap) - minX;
            dy = snapV(atWorld.y, ctx.snap) - minY;
        }
        for (const n of clip.nodes) {
            const id = 'n' + (state.nid++);
            map[n.id] = id;
            state.nodes[id] = { ...n, id, x: n.x + dx, y: n.y + dy };
            state.sel.add(id);
        }
        for (const e of clip.edges) {
            state.edges.push({ ...e, id: 'e' + (state.eid++), from: map[e.from], to: map[e.to] });
        }
        ctx.hooks.render();
        ctx.hooks.sync();
        ctx.hooks.renderInspector();
        ctx.hooks.pushHistory();
    }
    function duplicateSel() {
        if (!state.sel.size)
            return;
        copySel();
        pasteClip();
        ctx.hooks.toast('Duplicated');
    }
    return { copySel, pasteClip, duplicateSel };
}
