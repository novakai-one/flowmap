/* diff-views/overlay.ts — ghost overlay on a mini-canvas (View 4).
   Draws the AFTER model's node positions as an SVG. Colours each node by
   diff status: added=green, changed=amber ring, unchanged=dim. Removed
   nodes (absent from after) are drawn at their BEFORE position as red
   ghosts. Edges added=green, removed=red-dashed, rest dim. Spatial view:
   see the change in place rather than as a list. */
import { type ViewArg, el, splitEdgeKey } from './types';
import type { DiagramNode } from '../../core/types/types';

export function renderOverlay(host: HTMLElement, arg: ViewArg): void {
  const { diff, before, after } = arg;
  host.innerHTML = '';

  const total = diff.counts.nAdd + diff.counts.nRem + diff.counts.nChg + diff.counts.eAdd + diff.counts.eRem;
  if (total === 0) {
    host.appendChild(el('div', 'diff-empty', 'No changes to overlay.'));
    return;
  }

  const addedSet = new Set(diff.addedNodes);
  const removedSet = new Set(diff.removedNodes);
  const changedSet = new Set(diff.changedNodes.map((c) => c.id));
  const addedEdges = new Set(diff.addedEdges);

  // node lookup: after positions, plus removed nodes from before
  const place: Record<string, DiagramNode> = {};
  for (const id in after.nodes) place[id] = after.nodes[id];
  for (const id of removedSet) if (before.nodes[id]) place[id] = before.nodes[id];

  const ids = Object.keys(place);
  if (!ids.length) { host.appendChild(el('div', 'diff-empty', 'No positioned nodes to draw.')); return; }

  // bounds → viewBox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const id of ids) {
    const n = place[id];
    const w = n.w || 160, h = n.h || 56;
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
  }
  const pad = 60;
  const vbX = minX - pad, vbY = minY - pad, vbW = (maxX - minX) + pad * 2, vbH = (maxY - minY) + pad * 2;

  const center = (n: DiagramNode) => ({ x: n.x + (n.w || 160) / 2, y: n.y + (n.h || 56) / 2 });

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
  svg.setAttribute('class', 'dv-ovl-svg');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const mk = (tag: string, attrs: Record<string, string | number>): SVGElement => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, String(attrs[k]));
    return e;
  };

  // ---- edges first (under nodes) ----
  const drawEdge = (from: string, to: string, cls: string): void => {
    const a = place[from], b = place[to];
    if (!a || !b) return;
    const p1 = center(a), p2 = center(b);
    svg.appendChild(mk('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: `dv-ovl-edge ${cls}` }));
  };
  // unchanged after-edges dim
  for (const e of after.edges) {
    const key = `${e.from}->${e.to}:${e.style}`;
    if (addedEdges.has(key)) continue;
    drawEdge(e.from, e.to, 'eq');
  }
  // added (green) + removed (red)
  diff.addedEdges.forEach((k) => { const { from, to } = splitEdgeKey(k); drawEdge(from, to, 'add'); });
  diff.removedEdges.forEach((k) => { const { from, to } = splitEdgeKey(k); drawEdge(from, to, 'rem'); });

  // ---- nodes ----
  for (const id of ids) {
    const n = place[id];
    const w = n.w || 160, h = n.h || 56;
    let cls = 'eq';
    if (addedSet.has(id)) cls = 'add';
    else if (removedSet.has(id)) cls = 'rem';
    else if (changedSet.has(id)) cls = 'chg';
    svg.appendChild(mk('rect', { x: n.x, y: n.y, width: w, height: h, rx: 10, class: `dv-ovl-node ${cls}` }));
    const c = center(n);
    const label = mk('text', { x: c.x, y: c.y + 4, 'text-anchor': 'middle', class: `dv-ovl-label ${cls}` });
    label.textContent = id;
    svg.appendChild(label);
  }

  const wrap = el('div', 'dv-ovl');
  // legend
  const legend = el('div', 'dv-ovl-legend');
  legend.innerHTML =
    '<span class="dv-leg add">added</span>'
    + '<span class="dv-leg rem">removed</span>'
    + '<span class="dv-leg chg">changed</span>'
    + '<span class="dv-leg eq">unchanged</span>';
  wrap.appendChild(legend);
  wrap.appendChild(svg);
  host.appendChild(wrap);
}
