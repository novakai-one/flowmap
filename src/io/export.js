/* =====================================================================
   export.ts — SVG + PNG export
   ---------------------------------------------------------------------
   Responsibility: build a clean standalone SVG from the model (not from
   DOM scraping) honoring the live theme, render each node to SVG
   (nodeSVG, including crude label wrapping), and export as a downloaded
   .svg or rasterized .png. Reuses bestSides/portPos + orthoPath/midOf.

   Pure builder + a couple of blob downloads. Does not mutate the model.
   ===================================================================== */
import { portPos, bestSides } from '../core/state';
import { esc } from '../core/config';
import { orthoPath, midOf } from '../render/wires';
/** Render a single node to SVG markup. */
export function nodeSVG(n, x, y, th) {
    const cx = x + n.w / 2, cy = y + n.h / 2;
    const fill = n.color || th.node;
    const stroke = th.stroke;
    const txt = (label, tx, ty, color, size = 13) => `<text x="${tx}" y="${ty}" fill="${color}" font-size="${size}" text-anchor="middle" dominant-baseline="middle">${esc(label)}</text>`;
    let s = '';
    switch (n.shape) {
        case 'diamond': {
            const pts = `${cx},${y} ${x + n.w},${cy} ${cx},${y + n.h} ${x},${cy}`;
            s += `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
            break;
        }
        case 'circle':
            s += `<ellipse cx="${cx}" cy="${cy}" rx="${n.w / 2}" ry="${n.h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
            break;
        case 'cylinder': {
            const r = Math.max(6, Math.min(n.h * 0.16, 22));
            s += `<path d="M ${x} ${y + r} L ${x} ${y + n.h - r} A ${n.w / 2} ${r} 0 0 0 ${x + n.w} ${y + n.h - r} L ${x + n.w} ${y + r} Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
            s += `<ellipse cx="${cx}" cy="${y + r}" rx="${n.w / 2}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
            break;
        }
        case 'hex': {
            const q = Math.min(n.w * 0.22, n.h * 0.5);
            const pts = `${x + q},${y} ${x + n.w - q},${y} ${x + n.w},${cy} ${x + n.w - q},${y + n.h} ${x + q},${y + n.h} ${x},${cy}`;
            s += `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
            break;
        }
        case 'stadium':
            s += `<rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="${n.h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
            break;
        case 'note':
            s += `<rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="3" fill="${th.noteBg}" stroke="${th.noteStroke}" stroke-width="1.5"/>`;
            break;
        case 'group':
            s += `<rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="8" fill="none" stroke="${th.accent}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.7"/>`;
            s += `<text x="${x + 12}" y="${y + 18}" fill="${th.accent}" font-size="11" font-family="monospace" letter-spacing="1">${esc(n.label.toUpperCase())}</text>`;
            return s; // group label only
        case 'round':
            s += `<rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="18" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
            break;
        default:
            s += `<rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    }
    const tcolor = n.shape === 'note' ? th.noteInk : th.ink;
    // wrap long labels crudely
    const words = (n.label || '').split(' ');
    const maxChars = Math.max(6, Math.floor(n.w / 8));
    const lines = [];
    let line = '';
    words.forEach((w) => {
        if ((line + ' ' + w).trim().length > maxChars) {
            if (line)
                lines.push(line);
            line = w;
        }
        else
            line = (line + ' ' + w).trim();
    });
    if (line)
        lines.push(line);
    const lh = 15, startY = cy - (lines.length - 1) * lh / 2;
    lines.forEach((ln, i) => { s += txt(ln, cx, startY + i * lh, tcolor); });
    return s;
}
export function initExport(ctx) {
    const { state } = ctx;
    function buildExportSVG(scale = 1) {
        const ids = Object.keys(state.nodes);
        if (!ids.length)
            return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        ids.forEach((id) => {
            const n = state.nodes[id];
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + n.w);
            maxY = Math.max(maxY, n.y + n.h);
        });
        const pad = 40;
        const W = (maxX - minX) + pad * 2, H = (maxY - minY) + pad * 2;
        const ox = pad - minX, oy = pad - minY;
        const cs = getComputedStyle(document.documentElement);
        const C = (k) => cs.getPropertyValue(k).trim();
        const th = {
            bg: C('--bg'), node: C('--node-bg'), stroke: C('--node-stroke'), ink: C('--node-ink'),
            noteBg: C('--note-bg'), noteStroke: C('--note-stroke'), noteInk: C('--note-ink'),
            accent: C('--accent'), edge: C('--edge'), labelBg: C('--label-bg'),
            line: C('--line'), inkDim: C('--ink-dim'), font: C('--node-font') || 'system-ui, sans-serif',
        };
        const NS = 'http://www.w3.org/2000/svg';
        let s = `<svg xmlns="${NS}" width="${W * scale}" height="${H * scale}" viewBox="0 0 ${W} ${H}" font-family="${th.font.replace(/"/g, "'")}">`;
        s += `<rect width="${W}" height="${H}" fill="${th.bg}"/>`;
        s += `<defs><marker id="ar" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" fill="${th.edge}"/></marker></defs>`;
        // edges
        for (const e of state.edges) {
            const a = state.nodes[e.from], b = state.nodes[e.to];
            if (!a || !b)
                continue;
            const [sa, sb] = bestSides(a, b);
            const p = portPos(a, sa), q = portPos(b, sb);
            const P = { x: p.x + ox, y: p.y + oy }, Q = { x: q.x + ox, y: q.y + oy };
            const d = e.routing === 'ortho' ? orthoPath(P, sa, Q, sb) : `M ${P.x} ${P.y} L ${Q.x} ${Q.y}`;
            const dash = e.style === 'dotted' ? '5 5' : '0';
            const wd = e.style === 'thick' ? 3 : 1.7;
            s += `<path d="${d}" stroke="${th.edge}" stroke-width="${wd}" fill="none" stroke-dasharray="${dash}" marker-end="url(#ar)" stroke-linejoin="round"/>`;
            if (e.label) {
                const mid = midOf(d);
                const tw = e.label.length * 6.2 + 10;
                s += `<rect x="${mid.x - tw / 2}" y="${mid.y - 9}" width="${tw}" height="18" rx="4" fill="${th.labelBg}" stroke="${th.line}"/>`;
                s += `<text x="${mid.x}" y="${mid.y + 3.5}" fill="${th.inkDim}" font-size="10.5" font-family="monospace" text-anchor="middle">${esc(e.label)}</text>`;
            }
        }
        // nodes (groups first)
        const ord = ids.sort((a, b) => (state.nodes[a].shape === 'group' ? 0 : 1) - (state.nodes[b].shape === 'group' ? 0 : 1));
        for (const id of ord) {
            const n = state.nodes[id];
            s += nodeSVG(n, n.x + ox, n.y + oy, th);
        }
        s += `</svg>`;
        return { svg: s, W, H };
    }
    function downloadBlob(blob, name) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    function exportSVG() {
        const r = buildExportSVG(1);
        if (!r) {
            ctx.hooks.toast('Nothing to export');
            return;
        }
        downloadBlob(new Blob([r.svg], { type: 'image/svg+xml' }), 'flowmap.svg');
        ctx.hooks.toast('SVG exported');
    }
    function exportPNG() {
        const r = buildExportSVG(2); // 2x for retina
        if (!r) {
            ctx.hooks.toast('Nothing to export');
            return;
        }
        const img = new Image();
        const blob = new Blob([r.svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = r.W * 2;
            canvas.height = r.H * 2;
            const c2d = canvas.getContext('2d');
            if (!c2d) {
                ctx.hooks.toast('PNG render failed');
                return;
            }
            c2d.drawImage(img, 0, 0);
            canvas.toBlob((b) => { if (b) {
                downloadBlob(b, 'flowmap.png');
                ctx.hooks.toast('PNG exported');
            } });
            URL.revokeObjectURL(url);
        };
        img.onerror = () => ctx.hooks.toast('PNG render failed');
        img.src = url;
    }
    return { exportSVG, exportPNG };
}
