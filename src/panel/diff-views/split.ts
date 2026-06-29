/* diff-views/split.ts — git-style two-column line diff (View 2).
   Computes an LCS line alignment between before/after text so unchanged
   lines sit side-by-side and add/remove lines are marked in the gutter. */
import { type ViewArg, el } from './types';

type Op = { tag: 'eq' | 'add' | 'rem'; left?: string; right?: string };

/** Myers-lite via LCS table on line arrays. Fine for diagram-sized text. */
function lineDiff(a: string[], b: string[]): Op[] {
  const n = a.length, m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const ops: Op[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ tag: 'eq', left: a[i], right: b[j] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { ops.push({ tag: 'rem', left: a[i] }); i++; }
    else { ops.push({ tag: 'add', right: b[j] }); j++; }
  }
  while (i < n) { ops.push({ tag: 'rem', left: a[i++] }); }
  while (j < m) { ops.push({ tag: 'add', right: b[j++] }); }
  return ops;
}

export function renderSplit(host: HTMLElement, arg: ViewArg): void {
  host.innerHTML = '';
  const a = arg.beforeText.replace(/\s+$/, '').split('\n');
  const b = arg.afterText.replace(/\s+$/, '').split('\n');
  const ops = lineDiff(a, b);

  const wrap = el('div', 'dv-split');
  const colL = el('div', 'dv-split-col');
  const colR = el('div', 'dv-split-col');
  colL.appendChild(el('div', 'dv-split-head', 'before · current'));
  colR.appendChild(el('div', 'dv-split-head', 'after · proposal'));

  for (const op of ops) {
    if (op.tag === 'eq') {
      colL.appendChild(lineRow('', op.left!, 'eq'));
      colR.appendChild(lineRow('', op.right!, 'eq'));
    } else if (op.tag === 'rem') {
      colL.appendChild(lineRow('−', op.left!, 'rem'));
      colR.appendChild(lineRow('', '', 'pad'));
    } else {
      colL.appendChild(lineRow('', '', 'pad'));
      colR.appendChild(lineRow('+', op.right!, 'add'));
    }
  }
  wrap.appendChild(colL); wrap.appendChild(colR);
  host.appendChild(wrap);
}

function lineRow(mark: string, text: string, cls: string): HTMLElement {
  const row = el('div', `dv-line ${cls}`);
  const g = el('span', 'dv-gutter', mark);
  const t = el('span', 'dv-code', text);
  row.appendChild(g); row.appendChild(t);
  return row;
}
