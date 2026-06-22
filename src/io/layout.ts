/* =====================================================================
   layout.ts — automatic layered-tree layout
   ---------------------------------------------------------------------
   Responsibility: the "Tidy" auto-layout. Pipeline per press:
     1. capture group membership (geometric, before nodes move)
     2. find back-edges (DFS) so cycles do not collapse the layering
     3. layer the forward graph via longest-path (Kahn)
     4. order each layer by barycenter to reduce edge crossings
     5. position nodes by their rendered footprint (box + frontmatter card)
        along the flow direction (state.dir: TD/BT/LR/RL)
     6. resize each group box to wrap its captured members

   Mutates node x/y (and group x/y/w/h) only, never a node's own w/h.
   Re-renders, syncs, pushes history, zoom-to-fits.
   ===================================================================== */

import type { AppContext } from '../core/context';
import type { CameraApi } from '../core/camera';
import type { FlowDir } from '../core/types';
import { snapV } from '../core/state';

export interface LayoutApi {
  autoLayout: () => void;
}

/** Gap between siblings within one layer. */
const SIBLING_GAP = 70;
/** Gap between consecutive layers. */
const LAYER_GAP = 90;
/** Gap between a node box and its frontmatter card (CSS uses 6). */
const CARD_GAP = 6;
/** Canvas origin for the whole layout. */
const ORIGIN_X = 80;
const ORIGIN_Y = 80;
/** Padding between a group box and the members it wraps. */
const GROUP_PAD = 24;
/** Barycenter ordering sweeps (down-only; more = tidier, slower). */
const CROSS_SWEEPS = 2;

/** Rendered size of a node including its frontmatter card. */
interface Footprint { w: number; h: number; }

/** Forward graph (cycle-free) used for layering + ordering. */
interface Forward {
  out: Record<string, string[]>;
  indeg: Record<string, number>;
  parents: Record<string, string[]>;
}

/** Key for one directed edge, used in the back-edge set. */
const edgeKey = (from: string, to: string): string => from + '\u0000' + to;

export function initLayout(ctx: AppContext, camera: CameraApi): LayoutApi {
  const { state } = ctx;

  /**
   * Measure a node's on-canvas footprint in layout pixels. offsetWidth/
   * Height are unscaled by camera zoom, so they are true world sizes. The
   * card hangs below the node and is centred on it: width = max(box, card),
   * height = box + card.
   */
  function footprint(id: string): Footprint {
    const n = state.nodes[id];
    const el = ctx.dom.world.querySelector<HTMLElement>(`.node[data-id="${id}"]`);
    if (!el) return { w: n.w, h: n.h };
    const card = el.querySelector<HTMLElement>('.fmcard');
    if (!card) return { w: el.offsetWidth, h: el.offsetHeight };
    return {
      w: Math.max(el.offsetWidth, card.offsetWidth),
      h: el.offsetHeight + CARD_GAP + card.offsetHeight,
    };
  }

  /** Which non-group nodes sit inside each group box (centre-in-box). */
  function captureGroups(): Record<string, string[]> {
    const groups = Object.keys(state.nodes).filter((id) => state.nodes[id].shape === 'group');
    const mem: Record<string, string[]> = {};
    for (const g of groups) {
      const G = state.nodes[g];
      mem[g] = Object.keys(state.nodes).filter((id) => {
        const n = state.nodes[id];
        if (n.shape === 'group') return false;
        const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
        return cx >= G.x && cx <= G.x + G.w && cy >= G.y && cy <= G.y + G.h;
      });
    }
    return mem;
  }

  /**
   * Classify cycle-closing edges via DFS colouring. An edge into a node
   * still on the active stack (grey) closes a loop and is a back-edge.
   * Groups are not layout participants, so edges touching them are ignored.
   */
  function findBackEdges(ids: string[]): Set<string> {
    const out: Record<string, string[]> = {};
    ids.forEach((id) => { out[id] = []; });
    state.edges.forEach((e) => {
      if (out[e.from] && state.nodes[e.to] && state.nodes[e.to].shape !== 'group') out[e.from].push(e.to);
    });

    const back = new Set<string>();
    const color: Record<string, number> = {}; // 0 = unseen, 1 = on stack, 2 = done
    ids.forEach((id) => { color[id] = 0; });

    const stack: { id: string; i: number }[] = [];
    for (const root of ids) {
      if (color[root] !== 0) continue;
      stack.push({ id: root, i: 0 }); color[root] = 1;
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.i < out[top.id].length) {
          const v = out[top.id][top.i++];
          if (color[v] === 1) back.add(edgeKey(top.id, v));
          else if (color[v] === 0) { color[v] = 1; stack.push({ id: v, i: 0 }); }
        } else { color[top.id] = 2; stack.pop(); }
      }
    }
    return back;
  }

  /** Build the cycle-free forward graph, skipping back-edges + group edges. */
  function forwardGraph(ids: string[], back: Set<string>): Forward {
    const out: Record<string, string[]> = {};
    const indeg: Record<string, number> = {};
    const parents: Record<string, string[]> = {};
    ids.forEach((id) => { out[id] = []; indeg[id] = 0; parents[id] = []; });
    state.edges.forEach((e) => {
      if (!out[e.from] || !state.nodes[e.to] || state.nodes[e.to].shape === 'group') return;
      if (back.has(edgeKey(e.from, e.to))) return;
      out[e.from].push(e.to); indeg[e.to]++; parents[e.to].push(e.from);
    });
    return { out, indeg, parents };
  }

  /** Longest-path layer index per node (Kahn) on the forward graph. */
  function assignLayers(ids: string[], fwd: Forward): Record<string, number> {
    const layer: Record<string, number> = {};
    ids.forEach((id) => { layer[id] = 0; });
    const deg = { ...fwd.indeg };
    const q = ids.filter((id) => deg[id] === 0);
    const seen = new Set<string>();
    let guard = 0;
    while (q.length && guard++ < 99999) {
      const id = q.shift() as string;
      if (seen.has(id)) continue; seen.add(id);
      for (const nx of fwd.out[id]) {
        layer[nx] = Math.max(layer[nx], layer[id] + 1);
        if (--deg[nx] <= 0) q.push(nx);
      }
    }
    return layer;
  }

  /**
   * Reorder each layer by the mean position of its parents in the layer
   * above (barycenter). Reduces edge crossings versus insertion order.
   * Down-only sweep: layer 0 keeps its order, each lower layer follows.
   */
  function orderByBarycenter(layers: number[], byLayer: Record<number, string[]>, parents: Record<string, string[]>): void {
    const pos: Record<string, number> = {};
    (byLayer[layers[0]] || []).forEach((id, i) => { pos[id] = i; });
    for (let s = 0; s < CROSS_SWEEPS; s++) {
      for (let li = 1; li < layers.length; li++) {
        const row = byLayer[layers[li]];
        const key: Record<string, number> = {};
        row.forEach((id, i) => {
          const ps = parents[id].filter((p) => p in pos);
          key[id] = ps.length ? ps.reduce((a, p) => a + pos[p], 0) / ps.length : i;
        });
        row.sort((a, b) => key[a] - key[b]);
        row.forEach((id, i) => { pos[id] = i; });
      }
    }
  }

  /** Grow each group box to wrap the members captured before layout. */
  function wrapGroups(mem: Record<string, string[]>): void {
    for (const g in mem) {
      const members = mem[g];
      if (!members.length) continue;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const id of members) {
        const n = state.nodes[id];
        minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
      }
      const G = state.nodes[g];
      G.x = snapV(minX - GROUP_PAD, ctx.snap);
      G.y = snapV(minY - GROUP_PAD, ctx.snap);
      G.w = (maxX - minX) + GROUP_PAD * 2;
      G.h = (maxY - minY) + GROUP_PAD * 2;
    }
  }

  function autoLayout(): void {
    const ids = Object.keys(state.nodes).filter((id) => state.nodes[id].shape !== 'group');
    if (!ids.length) return;

    const groupMem = captureGroups();              // before anything moves
    const back = findBackEdges(ids);
    const fwd = forwardGraph(ids, back);
    const layer = assignLayers(ids, fwd);

    const byLayer: Record<number, string[]> = {};
    ids.forEach((id) => { (byLayer[layer[id]] ||= []).push(id); });
    const layers = Object.keys(byLayer).map(Number).sort((a, b) => a - b);

    orderByBarycenter(layers, byLayer, fwd.parents);

    const foot: Record<string, Footprint> = {};
    ids.forEach((id) => { foot[id] = footprint(id); });

    const dir: FlowDir = state.dir;
    const horizontal = dir === 'LR' || dir === 'RL'; // layers advance along X
    const reversed = dir === 'BT' || dir === 'RL';    // layer 0 placed last

    const thickness = layers.map((L) =>
      Math.max(...byLayer[L].map((id) => (horizontal ? foot[id].w : foot[id].h))));
    const crossRun = layers.map((L) => {
      const sizes = byLayer[L].map((id) => (horizontal ? foot[id].h : foot[id].w));
      return sizes.reduce((a, b) => a + b, 0) + SIBLING_GAP * Math.max(0, byLayer[L].length - 1);
    });
    const maxCross = Math.max(...crossRun);

    const mainStart: number[] = [];
    let acc = 0;
    layers.forEach((_, i) => { mainStart[i] = acc; acc += thickness[i] + LAYER_GAP; });
    const mainTotal = acc - LAYER_GAP;

    layers.forEach((L, i) => {
      const band = reversed ? mainTotal - mainStart[i] - thickness[i] : mainStart[i];
      let cross = (maxCross - crossRun[i]) / 2;
      for (const id of byLayer[L]) {
        const n = state.nodes[id];
        const f = foot[id];
        if (horizontal) {
          // layers along X (centre box in band), siblings along Y (top-align)
          n.x = snapV(ORIGIN_X + band + (thickness[i] - n.w) / 2, ctx.snap);
          n.y = snapV(ORIGIN_Y + cross, ctx.snap);
          cross += f.h + SIBLING_GAP;
        } else {
          // layers along Y (top-align box in band), siblings along X (centre slot)
          n.x = snapV(ORIGIN_X + cross + (f.w - n.w) / 2, ctx.snap);
          n.y = snapV(ORIGIN_Y + band, ctx.snap);
          cross += f.w + SIBLING_GAP;
        }
      }
    });

    wrapGroups(groupMem);

    ctx.hooks.render(); ctx.hooks.sync(); ctx.hooks.pushHistory();
    camera.zoomToFit();
    ctx.hooks.toast('Tidied · ' + dir);
  }

  return { autoLayout };
}
