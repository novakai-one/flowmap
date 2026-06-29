/* diff-views/list.ts — grouped, expandable change list (View 1). */
import { type ViewArg, el, splitEdgeKey } from './types';

export function renderList(host: HTMLElement, arg: ViewArg): void {
  const { diff, before, after } = arg;
  host.innerHTML = '';
  const root = el('div', 'dv-list');

  const total = diff.counts.nAdd + diff.counts.nRem + diff.counts.nChg + diff.counts.eAdd + diff.counts.eRem;
  if (total === 0) {
    root.appendChild(el('div', 'diff-empty', 'No changes. Proposal is identical to current.'));
    host.appendChild(root);
    return;
  }

  const section = (title: string, cls: string, n: number, rows: HTMLElement[]): void => {
    if (!n) return;
    const sec = el('div', 'dv-sec');
    const head = el('button', 'dv-sec-head');
    head.innerHTML = `<span class="dv-caret">▾</span><span class="dv-sec-title ${cls}">${title}</span><span class="dv-sec-n">${n}</span>`;
    const bodyEl = el('div', 'dv-sec-body');
    rows.forEach((r) => bodyEl.appendChild(r));
    head.onclick = () => {
      const open = bodyEl.style.display !== 'none';
      bodyEl.style.display = open ? 'none' : 'block';
      (head.querySelector('.dv-caret') as HTMLElement).textContent = open ? '▸' : '▾';
    };
    sec.appendChild(head); sec.appendChild(bodyEl);
    root.appendChild(sec);
  };

  // added nodes
  section('Added nodes', 'add', diff.counts.nAdd, diff.addedNodes.map((id) => {
    const n = after.nodes[id];
    return el('div', 'dv-row add', `+ ${id}  ·  ${n?.kind ?? n?.shape ?? ''}`);
  }));

  // removed nodes
  section('Removed nodes', 'rem', diff.counts.nRem, diff.removedNodes.map((id) => {
    const n = before.nodes[id];
    return el('div', 'dv-row rem', `− ${id}  ·  ${n?.kind ?? n?.shape ?? ''}`);
  }));

  // changed nodes (group by id)
  const byId = new Map<string, typeof diff.changedNodes>();
  diff.changedNodes.forEach((c) => {
    if (!byId.has(c.id)) byId.set(c.id, []);
    byId.get(c.id)!.push(c);
  });
  const changedRows: HTMLElement[] = [];
  byId.forEach((changes, id) => {
    const row = el('div', 'dv-row-block');
    row.appendChild(el('div', 'dv-row chg', `~ ${id}`));
    changes.forEach((c) => {
      const f = el('div', 'dv-field');
      f.innerHTML = `<span class="dv-field-name">${c.field}</span>`
        + `<div class="dv-before">− ${escapeHtml(c.before) || '<em>empty</em>'}</div>`
        + `<div class="dv-after">+ ${escapeHtml(c.after) || '<em>empty</em>'}</div>`;
      row.appendChild(f);
    });
    changedRows.push(row);
  });
  section('Changed nodes', 'chg', diff.counts.nChg, changedRows);

  // edges
  const edgeRows: HTMLElement[] = [];
  diff.addedEdges.forEach((k) => {
    const { from, to, style } = splitEdgeKey(k);
    edgeRows.push(el('div', 'dv-row add', `+ ${from} →|${style}| ${to}`));
  });
  diff.removedEdges.forEach((k) => {
    const { from, to, style } = splitEdgeKey(k);
    edgeRows.push(el('div', 'dv-row rem', `− ${from} →|${style}| ${to}`));
  });
  section('Edge changes', 'add', diff.counts.eAdd + diff.counts.eRem, edgeRows);

  host.appendChild(root);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}
