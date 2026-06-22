/* =====================================================================
   wires.ts — edge rendering + path geometry
   ---------------------------------------------------------------------
   Responsibility: draw all edges into the #wires SVG (visible path + fat
   invisible hit-path + optional midpoint label), and provide the path
   geometry helpers orthoPath() and midOf() that are reused by export.

   Reads: ctx.state. Writes: only #wires and edge-label DOM under #world.
   ===================================================================== */
import { portPos, bestSides } from '../core/state';
const SVG_NS = 'http://www.w3.org/2000/svg';
/** Orthogonal elbow path between two ports given their sides. */
export function orthoPath(p, sa, q, sb) {
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const aH = sa === 'pl' || sa === 'pr';
    const bH = sb === 'pl' || sb === 'pr';
    if (aH && bH)
        return `M ${p.x} ${p.y} L ${mx} ${p.y} L ${mx} ${q.y} L ${q.x} ${q.y}`;
    if (!aH && !bH)
        return `M ${p.x} ${p.y} L ${p.x} ${my} L ${q.x} ${my} L ${q.x} ${q.y}`;
    if (aH && !bH)
        return `M ${p.x} ${p.y} L ${q.x} ${p.y} L ${q.x} ${q.y}`;
    return `M ${p.x} ${p.y} L ${p.x} ${q.y} L ${q.x} ${q.y}`;
}
/** Rough midpoint of an "M ... L ..." command list (for label placement). */
export function midOf(d) {
    const matched = d.match(/-?\d+(\.\d+)?/g);
    const pts = (matched || []).map(Number);
    const coords = [];
    for (let i = 0; i < pts.length; i += 2)
        coords.push({ x: pts[i], y: pts[i + 1] });
    if (coords.length === 2) {
        return { x: (coords[0].x + coords[1].x) / 2, y: (coords[0].y + coords[1].y) / 2 };
    }
    return coords[Math.floor(coords.length / 2)];
}
export function initWires(ctx) {
    const { wires, world } = ctx.dom;
    function drawWires() {
        const { state } = ctx;
        wires.innerHTML = `<defs>
      <marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L7,3 L0,6 Z" fill="var(--edge)"/>
      </marker>
      <marker id="arrowSel" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L7,3 L0,6 Z" fill="var(--sel)"/>
      </marker>
    </defs>`;
        for (const e of state.edges) {
            const a = state.nodes[e.from], b = state.nodes[e.to];
            if (!a || !b)
                continue;
            const [sa, sb] = bestSides(a, b);
            const p = portPos(a, sa), q = portPos(b, sb);
            const sel = state.selEdge === e.id;
            const d = (e.routing === 'ortho')
                ? orthoPath(p, sa, q, sb)
                : `M ${p.x} ${p.y} L ${q.x} ${q.y}`;
            // invisible fat hit-path for easy clicking
            const hit = document.createElementNS(SVG_NS, 'path');
            hit.setAttribute('d', d);
            hit.setAttribute('stroke', 'transparent');
            hit.setAttribute('stroke-width', '14');
            hit.setAttribute('fill', 'none');
            hit.setAttribute('class', 'hit');
            hit.dataset.eid = e.id;
            wires.appendChild(hit);
            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', d);
            path.setAttribute('stroke', sel ? 'var(--sel)' : 'var(--edge)');
            path.setAttribute('stroke-width', String(e.style === 'thick' ? 3 : 1.7));
            path.setAttribute('stroke-dasharray', e.style === 'dotted' ? '5 5' : '0');
            path.setAttribute('fill', 'none');
            path.setAttribute('marker-end', sel ? 'url(#arrowSel)' : 'url(#arrow)');
            path.setAttribute('stroke-linejoin', 'round');
            wires.appendChild(path);
            if (e.label) {
                const mid = midOf(d);
                const lab = document.createElement('div');
                lab.className = 'edgelabel' + (sel ? ' selected' : '');
                lab.dataset.eid = e.id;
                lab.textContent = e.label;
                lab.style.left = mid.x + 'px';
                lab.style.top = mid.y + 'px';
                world.appendChild(lab);
            }
        }
    }
    return { drawWires };
}
