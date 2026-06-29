/* =====================================================================
   diff.ts — compare two parsed diagram models
   ---------------------------------------------------------------------
   Responsibility: given a "before" and "after" model (each from
   io/mermaid.ts fromMermaid), compute the semantic delta — which nodes
   were added/removed/changed and which edges added/removed. Pure: no DOM,
   no state writes. The single source of truth for "what does this
   proposal change".

   Identity rules (deliberate, see BUILD_PLAN_DIFF_WORKSPACE.md):
     - Node identity   = node id.
     - Node "changed"  = same id, different label | shape | kind | fm.
                         Position (x/y/w/h) is layout, NOT a semantic change.
     - Edge identity   = "from->to:style". Edge .id (e1/e2..) is volatile
                         across a re-paste, so it is NOT used as the key.
   ===================================================================== */

import type { DiagramNode, DiagramEdge, Frontmatter } from '../types/types';

/** Minimal shape this module needs from a parsed model. */
export interface DiffInput {
  nodes: Record<string, DiagramNode>;
  edges: DiagramEdge[];
}

export interface NodeChange {
  id: string;
  field: string;   // which attribute differs (label | shape | kind | fm)
  before: string;
  after: string;
}

export interface MmdDiff {
  addedNodes: string[];
  removedNodes: string[];
  changedNodes: NodeChange[];
  addedEdges: string[];     // "from->to:style"
  removedEdges: string[];
  counts: {
    nAdd: number; nRem: number; nChg: number;
    eAdd: number; eRem: number;
    nUnchanged: number; eUnchanged: number;
  };
}

/** Stable edge key. Volatile .id is intentionally excluded. */
export function edgeKey(e: DiagramEdge): string {
  return `${e.from}->${e.to}:${e.style}`;
}

/** Stable frontmatter signature for change detection. */
function fmSig(fm?: Frontmatter): string {
  if (!fm) return '';
  const ifaces = (fm.interfaces ?? [])
    .map((i) => `${i.name}(${(i.accepts ?? []).join(',')})->(${(i.returns ?? []).join(',')})`)
    .join('|');
  return `${fm.name}\u00a7${fm.description}\u00a7${(fm.state ?? []).join(',')}\u00a7${ifaces}`;
}

/** Compare two models. Pure. */
export function diffModels(before: DiffInput, after: DiffInput): MmdDiff {
  const bN = before.nodes, aN = after.nodes;
  const bIds = Object.keys(bN), aIds = Object.keys(aN);
  const bSet = new Set(bIds), aSet = new Set(aIds);

  const addedNodes = aIds.filter((id) => !bSet.has(id)).sort();
  const removedNodes = bIds.filter((id) => !aSet.has(id)).sort();

  const changedNodes: NodeChange[] = [];
  let nUnchanged = 0;
  for (const id of aIds) {
    if (!bSet.has(id)) continue;           // added, handled above
    const b = bN[id], a = aN[id];
    const fields: [string, string, string][] = [
      ['label', b.label ?? '', a.label ?? ''],
      ['shape', b.shape ?? '', a.shape ?? ''],
      ['kind', (b.kind ?? '') as string, (a.kind ?? '') as string],
      ['fm', fmSig(b.fm), fmSig(a.fm)],
    ];
    let changed = false;
    for (const [field, bv, av] of fields) {
      if (bv !== av) { changedNodes.push({ id, field, before: bv, after: av }); changed = true; }
    }
    if (!changed) nUnchanged++;
  }
  changedNodes.sort((x, y) => x.id.localeCompare(y.id) || x.field.localeCompare(y.field));

  // edges by stable key
  const bEdges = new Map<string, DiagramEdge>();
  const aEdges = new Map<string, DiagramEdge>();
  for (const e of before.edges) bEdges.set(edgeKey(e), e);
  for (const e of after.edges) aEdges.set(edgeKey(e), e);

  const addedEdges: string[] = [];
  const removedEdges: string[] = [];
  let eUnchanged = 0;
  for (const k of aEdges.keys()) {
    if (bEdges.has(k)) eUnchanged++; else addedEdges.push(k);
  }
  for (const k of bEdges.keys()) {
    if (!aEdges.has(k)) removedEdges.push(k);
  }
  addedEdges.sort();
  removedEdges.sort();

  return {
    addedNodes, removedNodes, changedNodes, addedEdges, removedEdges,
    counts: {
      nAdd: addedNodes.length,
      nRem: removedNodes.length,
      nChg: new Set(changedNodes.map((c) => c.id)).size,
      eAdd: addedEdges.length,
      eRem: removedEdges.length,
      nUnchanged,
      eUnchanged,
    },
  };
}
