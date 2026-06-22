/* =====================================================================
   inspector-frontmatter.ts — the frontmatter editor in the side panel
   ---------------------------------------------------------------------
   Responsibility: render + wire the frontmatter editing UI for a single
   selected node inside the Inspector. Provides node-level name +
   description single fields, a node-level repeatable `state` list, and a
   list of public interfaces. Each interface has its own name plus
   repeatable accepts / returns lists. Writes straight into node.fm and
   triggers render+sync (and history on commit), mirroring how the label
   field behaves.

   Kept as its own module so the frontmatter UI can evolve without
   touching the rest of the inspector. The host inspector calls
   renderFrontmatterSection(host, node) and this module owns everything
   inside that host element.
   ===================================================================== */
import { esc } from '../core/config';
import { emptyFrontmatter, emptyInterface, isFrontmatterEmpty } from '../core/frontmatter';
const IFACE_LISTS = ['accepts', 'returns'];
const PLACEHOLDER = {
    state: 'count: number',
    accepts: 'key: string',
    returns: 'Snapshot',
};
export function initInspectorFrontmatter(ctx) {
    /** Ensure the node has a frontmatter object to edit, return it. */
    function ensureFm(n) {
        if (!n.fm)
            n.fm = emptyFrontmatter();
        return n.fm;
    }
    /** After any edit: drop the fm entirely if the user blanked everything. */
    function cleanupIfEmpty(n) {
        if (n.fm && isFrontmatterEmpty(n.fm))
            n.fm = undefined;
    }
    /** A node-level state list (rows keyed only by item index). */
    function stateRowsHtml(items) {
        return items.map((val, i) => `
      <div class="fm-listrow">
        <input class="fm-input" data-fmstate data-i="${i}" value="${esc(val)}" placeholder="${PLACEHOLDER.state}">
        <button class="fm-x" data-fmstatedel data-i="${i}" title="Remove">×</button>
      </div>`).join('');
    }
    /** One accepts/returns row inside interface `ifIdx`. */
    function ifaceListRowsHtml(ifIdx, key, items) {
        return items.map((val, i) => `
      <div class="fm-listrow">
        <input class="fm-input" data-iflist="${key}" data-if="${ifIdx}" data-i="${i}" value="${esc(val)}" placeholder="${PLACEHOLDER[key]}">
        <button class="fm-x" data-ifdel="${key}" data-if="${ifIdx}" data-i="${i}" title="Remove">×</button>
      </div>`).join('');
    }
    /** One interface block: name + accepts list + returns list + remove. */
    function ifaceBlockHtml(ifIdx, iface) {
        return `
      <div class="fm-iface" data-ifblock="${ifIdx}">
        <div class="fm-listhead fm-iface-head">
          <input class="fm-input fm-iface-name" data-ifname data-if="${ifIdx}" value="${esc(iface.name)}" placeholder="interface ${ifIdx + 1}">
          <button class="fm-x" data-deliface data-if="${ifIdx}" title="Remove interface">×</button>
        </div>
        ${IFACE_LISTS.map((key) => `
          <div class="fm-listgroup">
            <div class="fm-listhead"><label>${key}</label><button class="fm-add" data-ifadd="${key}" data-if="${ifIdx}">+ add</button></div>
            <div class="fm-list" data-iflistwrap="${key}" data-if="${ifIdx}">${ifaceListRowsHtml(ifIdx, key, iface[key])}</div>
          </div>`).join('')}
      </div>`;
    }
    /**
     * Render the whole frontmatter section into `host`. Re-rendered wholesale
     * only when list items / interfaces are added or removed; plain text edits
     * write to the model without re-render so focus is preserved (same as the
     * label field).
     */
    function render(host, n) {
        const fm = n.fm;
        const present = fm && !isFrontmatterEmpty(fm);
        const interfaces = fm?.interfaces ?? [];
        host.innerHTML = `
      <div class="insp-sec-title fm-sec-title">
        <span>Frontmatter</span>
        <span class="fm-hint">public interface</span>
      </div>
      <div class="field"><label>name</label><input id="fmName" class="fm-input" value="${esc(fm?.name ?? '')}" placeholder="${esc(n.label)}"></div>
      <div class="field"><label>description</label><textarea id="fmDesc" class="fm-input fm-area" rows="2" placeholder="what this does">${esc(fm?.description ?? '')}</textarea></div>
      <div class="fm-listgroup">
        <div class="fm-listhead"><label>state</label><button class="fm-add" data-fmstateadd>+ add</button></div>
        <div class="fm-list" data-fmstatewrap>${stateRowsHtml(fm?.state ?? [])}</div>
      </div>
      <div class="fm-ifaces">
        <div class="fm-listhead fm-ifaces-head"><label>interfaces</label><button class="fm-add" data-addiface>+ add interface</button></div>
        ${interfaces.map((iface, i) => ifaceBlockHtml(i, iface)).join('')}
      </div>
      ${present ? '<button class="filebtn fm-clear" id="fmClear">Clear frontmatter</button>' : ''}
    `;
        wire(host, n);
    }
    function wire(host, n) {
        const reRender = () => render(host, n);
        const live = () => { ctx.hooks.render(); ctx.hooks.sync(); };
        const commit = () => { cleanupIfEmpty(n); ctx.hooks.pushHistory(); };
        // name
        const name = host.querySelector('#fmName');
        name.oninput = () => { ensureFm(n).name = name.value; live(); };
        name.onchange = commit;
        // description
        const desc = host.querySelector('#fmDesc');
        desc.oninput = () => { ensureFm(n).description = desc.value; live(); };
        desc.onchange = commit;
        // node-level state: edits
        host.querySelectorAll('input[data-fmstate]').forEach((elRaw) => {
            const el = elRaw;
            const i = +el.dataset.i;
            el.oninput = () => { ensureFm(n).state[i] = el.value; live(); };
            el.onchange = commit;
        });
        // node-level state: add
        host.querySelector('button[data-fmstateadd]')?.addEventListener('click', () => {
            ensureFm(n).state.push('');
            reRender();
            const inputs = host.querySelector('[data-fmstatewrap]')?.querySelectorAll('input');
            inputs?.[inputs.length - 1]?.focus();
            live();
        });
        // node-level state: remove
        host.querySelectorAll('button[data-fmstatedel]').forEach((btnRaw) => {
            const btn = btnRaw;
            btn.onclick = () => {
                const i = +btn.dataset.i;
                n.fm?.state.splice(i, 1);
                cleanupIfEmpty(n);
                reRender();
                live();
                ctx.hooks.pushHistory();
            };
        });
        // add an interface
        host.querySelector('button[data-addiface]')?.addEventListener('click', () => {
            ensureFm(n).interfaces.push(emptyInterface());
            reRender();
            // focus the new interface's name field
            const names = host.querySelectorAll('input[data-ifname]');
            names[names.length - 1]?.focus();
            live();
        });
        // remove an interface
        host.querySelectorAll('button[data-deliface]').forEach((btnRaw) => {
            const btn = btnRaw;
            btn.onclick = () => {
                const ifIdx = +btn.dataset.if;
                n.fm?.interfaces.splice(ifIdx, 1);
                cleanupIfEmpty(n);
                reRender();
                live();
                ctx.hooks.pushHistory();
            };
        });
        // interface name edits
        host.querySelectorAll('input[data-ifname]').forEach((elRaw) => {
            const el = elRaw;
            const ifIdx = +el.dataset.if;
            el.oninput = () => { ensureFm(n).interfaces[ifIdx].name = el.value; live(); };
            el.onchange = commit;
        });
        // interface accepts/returns edits
        host.querySelectorAll('input[data-iflist]').forEach((elRaw) => {
            const el = elRaw;
            const key = el.dataset.iflist;
            const ifIdx = +el.dataset.if;
            const i = +el.dataset.i;
            el.oninput = () => { ensureFm(n).interfaces[ifIdx][key][i] = el.value; live(); };
            el.onchange = commit;
        });
        // add to an interface's accepts/returns
        host.querySelectorAll('button[data-ifadd]').forEach((btnRaw) => {
            const btn = btnRaw;
            btn.onclick = () => {
                const key = btn.dataset.ifadd;
                const ifIdx = +btn.dataset.if;
                ensureFm(n).interfaces[ifIdx][key].push('');
                reRender();
                const wrap = host.querySelector(`[data-iflistwrap="${key}"][data-if="${ifIdx}"]`);
                const inputs = wrap?.querySelectorAll('input');
                inputs?.[inputs.length - 1]?.focus();
                live();
            };
        });
        // remove from an interface's accepts/returns
        host.querySelectorAll('button[data-ifdel]').forEach((btnRaw) => {
            const btn = btnRaw;
            btn.onclick = () => {
                const key = btn.dataset.ifdel;
                const ifIdx = +btn.dataset.if;
                const i = +btn.dataset.i;
                n.fm?.interfaces[ifIdx]?.[key].splice(i, 1);
                cleanupIfEmpty(n);
                reRender();
                live();
                ctx.hooks.pushHistory();
            };
        });
        // clear all frontmatter
        const clear = host.querySelector('#fmClear');
        if (clear) {
            clear.onclick = () => {
                n.fm = undefined;
                reRender();
                live();
                ctx.hooks.pushHistory();
            };
        }
    }
    return { renderFrontmatterSection: render };
}
