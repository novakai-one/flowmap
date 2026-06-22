/* =====================================================================
   context-menu.ts — right-click menu
   ---------------------------------------------------------------------
   Responsibility: build and position the right-click context menu (#ctx)
   with node-specific or canvas-specific actions, and hide it on outside
   click. Delegates each action to the relevant module API.
   ===================================================================== */
export function initContextMenu(ctx, deps) {
    const { stage } = ctx.dom;
    const { state } = ctx;
    const { camera, selection, nodes, clipboard, inlineEdit } = deps;
    const menu = document.getElementById('ctx');
    function showCtx(clientX, clientY, items) {
        menu.innerHTML = '';
        items.forEach((it) => {
            if (it === '-') {
                menu.appendChild(document.createElement('hr'));
                return;
            }
            const b = document.createElement('button');
            if (it.danger)
                b.className = 'danger-item';
            b.innerHTML = `<span>${it.label}</span>${it.sc ? `<span class="sc">${it.sc}</span>` : ''}`;
            b.onclick = () => { hideCtx(); it.fn(); };
            menu.appendChild(b);
        });
        menu.classList.add('show');
        const r = menu.getBoundingClientRect();
        let x = clientX, y = clientY;
        if (x + r.width > innerWidth)
            x = innerWidth - r.width - 6;
        if (y + r.height > innerHeight)
            y = innerHeight - r.height - 6;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
    }
    function hideCtx() { menu.classList.remove('show'); }
    stage.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const node = e.target.closest('.node');
        const w = camera.toWorld(e.clientX, e.clientY);
        if (node) {
            const id = node.dataset.id;
            if (!state.sel.has(id))
                selection.selectOnly(id);
            showCtx(e.clientX, e.clientY, [
                { label: 'Duplicate', sc: '⌘D', fn: clipboard.duplicateSel },
                { label: 'Copy', sc: '⌘C', fn: clipboard.copySel },
                { label: 'Bring to front', fn: () => nodes.bringToFront(id) },
                '-',
                { label: 'Edit label', sc: '⏎', fn: () => inlineEdit.beginEdit(id) },
                '-',
                { label: 'Delete', sc: '⌫', danger: true, fn: nodes.deleteSelection },
            ]);
        }
        else {
            showCtx(e.clientX, e.clientY, [
                { label: 'Add box here', fn: () => nodes.addNode('rect', w.x - 60, w.y - 26) },
                { label: 'Paste', sc: '⌘V', fn: () => clipboard.pasteClip(w) },
                '-',
                { label: 'Select all', sc: '⌘A', fn: selection.selectAll },
                { label: 'Zoom to fit', sc: 'F', fn: camera.zoomToFit },
            ]);
        }
    });
    document.addEventListener('pointerdown', (e) => { if (!menu.contains(e.target))
        hideCtx(); }, true);
    return { hideCtx };
}
