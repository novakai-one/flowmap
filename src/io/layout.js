/* =====================================================================
   layout.ts — automatic layered-tree layout
   ---------------------------------------------------------------------
   Responsibility: the "Tidy" auto-layout. Builds adjacency from edges,
   assigns layers via longest-path (Kahn), then positions nodes layer by
   layer along the flow direction (state.dir: TD/BT/LR/RL).

   Spacing uses each node's RENDERED footprint — the node box plus its
   frontmatter card — read from the live DOM, not the model w/h. The card
   is an absolute overlay that never grows node.w/h, so without this the
   cards overlap. Footprint spacing keeps the layout readable as the
   graph grows in node count and branching.

   Mutates node x/y only (never w/h), re-renders, syncs, pushes history,
   zoom-to-fits. Groups are skipped (they're containers).
   ===================================================================== */
import { snapV } from '../core/state';
/** Gap between siblings within one layer. */
const SIBLING_GAP = 70;
/** Gap between consecutive layers. */
const LAYER_GAP = 90;
/** Vertical gap between a node box and its frontmatter card (CSS uses 6). */
const CARD_GAP = 6;
/** Canvas origin for the whole layout. */
const ORIGIN_X = 80;
const ORIGIN_Y = 80;
export function initLayout(ctx, camera) {
    const { state } = ctx;
    /**
     * Measure a node's on-canvas footprint in layout pixels.
     * offsetWidth/Height are unscaled by camera zoom, so they are true
     * world-space sizes. The card hangs below the node and is centred on
     * it, so width = max(box, card) and height = box + card.
     */
    function footprint(id) {
        const n = state.nodes[id];
        const el = ctx.dom.world.querySelector(`.node[data-id="${id}"]`);
        if (!el)
            return { w: n.w, h: n.h };
        const card = el.querySelector('.fmcard');
        if (!card)
            return { w: el.offsetWidth, h: el.offsetHeight };
        return {
            w: Math.max(el.offsetWidth, card.offsetWidth),
            h: el.offsetHeight + CARD_GAP + card.offsetHeight,
        };
    }
    /** Longest-path layer index per node (Kahn). Pure on the given ids. */
    function assignLayers(ids) {
        const out = {};
        const indeg = {};
        ids.forEach((id) => { out[id] = []; indeg[id] = 0; });
        state.edges.forEach((e) => {
            if (out[e.from] && state.nodes[e.to]) {
                out[e.from].push(e.to);
                indeg[e.to] = (indeg[e.to] || 0) + 1;
            }
        });
        const layer = {};
        ids.forEach((id) => { layer[id] = 0; });
        const q = ids.filter((id) => indeg[id] === 0);
        const deg = { ...indeg };
        const seen = new Set();
        let guard = 0;
        while (q.length && guard++ < 9999) {
            const id = q.shift();
            if (seen.has(id))
                continue;
            seen.add(id);
            for (const nx of out[id]) {
                layer[nx] = Math.max(layer[nx], layer[id] + 1);
                if (--deg[nx] <= 0)
                    q.push(nx);
            }
        }
        return layer;
    }
    function autoLayout() {
        const ids = Object.keys(state.nodes).filter((id) => state.nodes[id].shape !== 'group');
        if (!ids.length)
            return;
        const layer = assignLayers(ids);
        // bucket ids by layer, in ascending layer order
        const byLayer = {};
        ids.forEach((id) => { (byLayer[layer[id]] ||= []).push(id); });
        const layers = Object.keys(byLayer).map(Number).sort((a, b) => a - b);
        // measure every node once
        const foot = {};
        ids.forEach((id) => { foot[id] = footprint(id); });
        const dir = state.dir;
        const horizontal = dir === 'LR' || dir === 'RL'; // layers advance along X
        const reversed = dir === 'BT' || dir === 'RL'; // layer 0 placed last
        // main axis = direction layers stack; cross axis = spread within a layer.
        // thickness[i] = layer i size along the main axis.
        // crossRun[i]  = total size along the cross axis (siblings + gaps).
        const thickness = layers.map((L) => Math.max(...byLayer[L].map((id) => (horizontal ? foot[id].w : foot[id].h))));
        const crossRun = layers.map((L) => {
            const row = byLayer[L];
            const sizes = row.map((id) => (horizontal ? foot[id].h : foot[id].w));
            return sizes.reduce((a, b) => a + b, 0) + SIBLING_GAP * Math.max(0, row.length - 1);
        });
        const maxCross = Math.max(...crossRun);
        // cumulative main-axis start per layer
        const mainStart = [];
        let acc = 0;
        layers.forEach((_, i) => { mainStart[i] = acc; acc += thickness[i] + LAYER_GAP; });
        const mainTotal = acc - LAYER_GAP;
        layers.forEach((L, i) => {
            const row = byLayer[L];
            // band along the main axis; reverse for BT/RL so layer 0 sits at the far end
            const band = reversed ? mainTotal - mainStart[i] - thickness[i] : mainStart[i];
            // centre each layer's run on the cross axis for a balanced tree
            let cross = (maxCross - crossRun[i]) / 2;
            row.forEach((id) => {
                const n = state.nodes[id];
                const f = foot[id];
                if (horizontal) {
                    // layers along X, siblings along Y. Card centres on node in X,
                    // so centre the box in the band; it hangs down in Y, so top-align.
                    n.x = snapV(ORIGIN_X + band + (thickness[i] - n.w) / 2, ctx.snap);
                    n.y = snapV(ORIGIN_Y + cross, ctx.snap);
                    cross += f.h + SIBLING_GAP;
                }
                else {
                    // layers along Y, siblings along X. Card centres on node in X,
                    // so centre the box in its slot; it hangs down in Y, so top-align.
                    n.x = snapV(ORIGIN_X + cross + (f.w - n.w) / 2, ctx.snap);
                    n.y = snapV(ORIGIN_Y + band, ctx.snap);
                    cross += f.w + SIBLING_GAP;
                }
            });
        });
        ctx.hooks.render();
        ctx.hooks.sync();
        ctx.hooks.pushHistory();
        camera.zoomToFit();
        ctx.hooks.toast('Tidied · ' + dir);
    }
    return { autoLayout };
}
