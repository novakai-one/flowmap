/* diff-views/impact.ts — blast radius (View 3).
   Not a line diff. Ranks every node TOUCHED by the change, by how many
   edges move around it. Answers "what does this reach", for scope review. */
import { type ViewArg, el, splitEdgeKey } from './types';

interface Hit { id: string; touch: number; reasons: string[]; sev: 'new' | 'gone' | 'chg' | 'edge'; }

export function renderImpact(host: HTMLElement, arg: ViewArg): void {
  const { diff, before, after } = arg;
  host.innerHTML = '';

  const total = diff.counts.nAdd + diff.counts.nRem + diff.counts.nChg + diff.counts.eAdd + diff.counts.eRem;
  if (total === 0) {
    host.appendChild(el('div', 'diff-empty', 'No changes — nothing impacted.'));
    return;
  }

  const hits = new Map<string, Hit>();
  const bump = (id: string, sev: Hit['sev'], reason: string): void => {
    let h = hits.get(id);
    if (!h) { h = { id, touch: 0, reasons: [], sev }; hits.set(id, h); }
    h.touch++;
    if (!h.reasons.includes(reason)) h.reasons.push(reason);
    // severity precedence: new/gone win over chg/edge
    if (sev === 'new' || sev === 'gone') h.sev = sev;
    else if (h.sev === 'edge' && sev === 'chg') h.sev = 'chg';
  };

  diff.addedNodes.forEach((id) => bump(id, 'new', 'new node'));
  diff.removedNodes.forEach((id) => bump(id, 'gone', 'removed node'));
  new Set(diff.changedNodes.map((c) => c.id)).forEach((id) => {
    const fields = diff.changedNodes.filter((c) => c.id === id).map((c) => c.field).join(', ');
    bump(id, 'chg', `changed: ${fields}`);
  });
  diff.addedEdges.forEach((k) => {
    const { from, to } = splitEdgeKey(k);
    bump(from, 'edge', '+outgoing edge'); bump(to, 'edge', '+incoming edge');
  });
  diff.removedEdges.forEach((k) => {
    const { from, to } = splitEdgeKey(k);
    bump(from, 'edge', '−outgoing edge'); bump(to, 'edge', '−incoming edge');
  });

  const list = [...hits.values()].sort((a, b) => b.touch - a.touch || a.id.localeCompare(b.id));
  const max = Math.max(1, ...list.map((h) => h.touch));

  const root = el('div', 'dv-impact');
  root.appendChild(el('div', 'dv-impact-cap', `blast radius · ${list.length} nodes touched · sorted by edges affected`));

  list.forEach((h) => {
    const exists = (h.id in before.nodes) || (h.id in after.nodes);
    const card = el('div', `dv-impact-row sev-${h.sev}`);
    const top = el('div', 'dv-impact-top');
    top.appendChild(el('span', 'dv-impact-id', h.id + (exists ? '' : ' (?)')));
    const barWrap = el('div', 'dv-impact-bar');
    const bar = el('div', `dv-impact-fill sev-${h.sev}`);
    bar.style.width = `${(h.touch / max) * 100}%`;
    barWrap.appendChild(bar);
    top.appendChild(barWrap);
    top.appendChild(el('span', 'dv-impact-n', `${h.touch}×`));
    card.appendChild(top);
    card.appendChild(el('div', 'dv-impact-why', h.reasons.join(' · ')));
    root.appendChild(card);
  });

  host.appendChild(root);
}
