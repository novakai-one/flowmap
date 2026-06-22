/* =====================================================================
   render.ts — model -> canvas DOM
   ---------------------------------------------------------------------
   Responsibility: the main render() that rebuilds node elements (and
   their ports / resize handles / inline-edit state) from the model, plus
   shapeMarkup() for crisp SVG shapes and updateStatus() for the counter.
   Delegates edge drawing to the wires module via a passed-in drawWires.

   Reads: ctx.state, ctx.runtime (editingId/linkSrc).
   Writes: only the DOM under #world. Does not mutate the model.
   ===================================================================== */
import { esc } from '../core/config';
import { isFrontmatterEmpty } from '../core/frontmatter';
/** Crisp SVG geometry for diamond / hex / cylinder shapes. */
export function shapeMarkup(n) {
    const w = n.w, h = n.h;
    const fill = n.color ? ` style="fill:${n.color}"` : '';
    const svg = (inner) => `<svg class="shape-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${inner}</svg>`;
    if (n.shape === 'diamond') {
        const pts = `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
        return svg(`<polygon class="shp" points="${pts}"${fill}/>`);
    }
    if (n.shape === 'hex') {
        const i = Math.min(w * 0.22, h * 0.5);
        const pts = `${i},0 ${w - i},0 ${w},${h / 2} ${w - i},${h} ${i},${h} 0,${h / 2}`;
        return svg(`<polygon class="shp" points="${pts}"${fill}/>`);
    }
    if (n.shape === 'cylinder') {
        const rx = w / 2, ry = Math.max(6, Math.min(h * 0.16, 22));
        const body = `M 0 ${ry} L 0 ${h - ry} A ${rx} ${ry} 0 0 0 ${w} ${h - ry} L ${w} ${ry} Z`;
        return svg(`<path class="shp" d="${body}"${fill}/>` +
            `<ellipse class="shp" cx="${rx}" cy="${ry}" rx="${rx}" ry="${ry}"${fill}/>`);
    }
    return '';
}
/**
 * @param drawWires edge-drawing function from the wires module (injected
 *        to keep render free of a direct import cycle with wires).
 */
/**
 * Build the read-only frontmatter card shown under a node on the canvas.
 * It's an absolutely-positioned overlay (see CSS .fmcard) so it never
 * affects the node's own dimensions. Editing happens in the inspector or
 * via the inline card editor; this is the display form.
 */
export function buildFmCard(fm) {
    const card = document.createElement('div');
    card.className = 'fmcard';
    const clean = (items) => items.filter((s) => s.trim());
    const row = (key, items) => clean(items).length
        ? `<div class="fmrow"><span class="fmkey">${key}</span><span class="fmval">${clean(items).map((s) => esc(s)).join(', ')}</span></div>`
        : '';
    let html = '';
    if (fm.name.trim())
        html += `<div class="fmrow"><span class="fmkey">name</span><span class="fmval">${esc(fm.name)}</span></div>`;
    if (fm.description.trim())
        html += `<div class="fmrow"><span class="fmkey">desc</span><span class="fmval">${esc(fm.description)}</span></div>`;
    html += row('state', fm.state);
    // one labelled block per interface; blocks with no accepts/returns are skipped
    for (const iface of fm.interfaces ?? []) {
        const body = row('accepts', iface.accepts) + row('returns', iface.returns);
        if (!body)
            continue;
        const title = iface.name.trim() ? esc(iface.name) : 'interface';
        html += `<div class="fmiface"><div class="fmiface-name">${title}</div>${body}</div>`;
    }
    card.innerHTML = html;
    return card;
}
export function initRender(ctx, drawWires) {
    const { world } = ctx.dom;
    const statusEl = document.getElementById('status');
    function updateStatus() {
        const nc = Object.keys(ctx.state.nodes).length, ec = ctx.state.edges.length;
        let s = `${nc} node${nc !== 1 ? 's' : ''} · ${ec} edge${ec !== 1 ? 's' : ''}`;
        if (ctx.state.sel.size)
            s += ` · ${ctx.state.sel.size} selected`;
        statusEl.textContent = s;
    }
    function render() {
        const { state, runtime } = ctx;
        // remove old nodes + edge labels but keep the <svg> wires element
        [...world.querySelectorAll('.node, .edgelabel')].forEach((e) => e.remove());
        // groups first (z-order) then the rest
        const ids = Object.keys(state.nodes).sort((a, b) => (state.nodes[a].shape === 'group' ? 0 : 1) - (state.nodes[b].shape === 'group' ? 0 : 1));
        for (const id of ids) {
            const n = state.nodes[id];
            const el = document.createElement('div');
            const isSel = state.sel.has(id);
            const svgShape = (n.shape === 'diamond' || n.shape === 'hex' || n.shape === 'cylinder');
            el.className = 'node shape-' + n.shape + (svgShape ? ' svgshape' : '')
                + (isSel ? ' selected' : '') + (runtime.linkSrc === id ? ' linksrc' : '');
            el.dataset.id = id;
            el.style.left = n.x + 'px';
            el.style.top = n.y + 'px';
            el.style.width = n.w + 'px';
            el.style.height = n.h + 'px';
            // custom fill: simple shapes paint the div, svg shapes paint the path
            if (n.color && !svgShape && n.shape !== 'group' && n.shape !== 'note')
                el.style.background = n.color;
            if (svgShape)
                el.insertAdjacentHTML('beforeend', shapeMarkup(n));
            const lab = document.createElement('span');
            lab.className = 'label';
            lab.textContent = n.label;
            el.appendChild(lab);
            // keep an in-progress inline edit alive across re-renders
            if (runtime.editingId === id) {
                el.classList.add('editing');
                lab.setAttribute('contenteditable', 'true');
            }
            // ports
            ['pt', 'pb', 'pl', 'pr'].forEach((p) => {
                const port = document.createElement('div');
                port.className = 'port ' + p;
                port.dataset.port = id;
                port.dataset.side = p;
                el.appendChild(port);
            });
            // resize handles only when single-selected
            if (isSel && state.sel.size === 1) {
                ['nw', 'ne', 'sw', 'se'].forEach((c) => {
                    const h = document.createElement('div');
                    h.className = 'rsz ' + c;
                    h.dataset.rsz = c;
                    h.dataset.id = id;
                    el.appendChild(h);
                });
            }
            // frontmatter card: an overlay BELOW the node, outside its box model,
            // so showing/hiding it never changes node size or spacing
            if (ctx.prefs.showFrontmatter && n.fm && !isFrontmatterEmpty(n.fm)) {
                el.appendChild(buildFmCard(n.fm));
            }
            world.appendChild(el);
        }
        drawWires();
        updateStatus();
        ctx.hooks.drawMinimap();
    }
    return { render, updateStatus };
}
