import fs from 'node:fs';
import { init, routeEdges } from '@mr_mint/elkjs-libavoid';

const F = '/sessions/great-trusting-pascal/mnt/flowmap/.claude/worktrees/vigilant-pike-7136af/novakai.mmd';
const text = fs.readFileSync(F, 'utf8');

const nodes = {}; // id -> {x,y,w,h,shape}
const edges = [];
let maxE = 0;
for (const raw of text.split('\n')) {
  const t = raw.trim();
  let m;
  if ((m = t.match(/^%% fm (\w+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (\w+)/))) {
    nodes[m[1]] = { x: +m[2], y: +m[3], w: +m[4], h: +m[5], shape: m[6] };
    continue;
  }
  if (t.startsWith('%%')) continue;
  if ((m = t.match(/^(\w+)\s*(?:-\.->|==>|-->|---)\s*(?:\|[^|]*\|)?\s*(\w+)/))) {
    edges.push({ id: 'e' + ++maxE, from: m[1], to: m[2] });
  }
}

const GROUP = new Set(Object.keys(nodes).filter((id) => nodes[id].shape === 'group'));
console.log(`nodes=${Object.keys(nodes).length} groups=${GROUP.size} edges=${edges.length}`);

// ---- direct geometry checks (no router) ----
const ids = Object.keys(nodes).filter((id) => !GROUP.has(id));
// 1) snap hypothesis: any two distinct nodes at EXACTLY same (x,y)?
const seen = new Map();
let coincident = 0;
for (const id of ids) {
  const n = nodes[id];
  const k = `${n.x},${n.y}`;
  if (seen.has(k)) { coincident++; console.log(`  coincident pos: ${id} == ${seen.get(k)} @ ${k}`); }
  else seen.set(k, id);
}
console.log(`coincident (x,y) pairs: ${coincident}`);

// 2) overlap of plain BOX rects
function overlap(a, b, pad = 0) {
  return a.x - pad < b.x + b.w + pad && b.x - pad < a.x + a.w + pad &&
         a.y - pad < b.y + b.h + pad && b.y - pad < a.y + a.h + pad;
}
function countOverlaps(rects, pad) {
  let c = 0;
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++)
      if (overlap(rects[i], rects[j], pad)) c++;
  return c;
}
const boxRects = ids.map((id) => ({ id, ...nodes[id] }));
console.log(`BOX overlaps pad0: ${countOverlaps(boxRects, 0)}  pad14(SHAPE_BUFFER): ${countOverlaps(boxRects, 14)}  pad4: ${countOverlaps(boxRects, 4)}`);

// 3) simulated CARD inflation: widen to a typical card width & add card height below.
// Cards are not stored; model a plausible card (~240w, ~120h) centred under box.
function cardRect(n, cardW = 240, cardH = 120, gap = 6) {
  const w = Math.max(n.w, cardW);
  const h = n.h + gap + cardH;
  return { x: n.x - (w - n.w) / 2, y: n.y, w, h };
}
const cardRects = ids.map((id) => ({ id, ...cardRect(nodes[id]) }));
console.log(`CARD overlaps pad0: ${countOverlaps(cardRects, 0)}  pad14: ${countOverlaps(cardRects, 14)}  pad4: ${countOverlaps(cardRects, 4)}`);

// capped card inflation (Option A cap): card cannot widen obstacle more than CAP px/side
function cappedCardRect(n, cap, cardW = 240, cardH = 120, gap = 6) {
  let w = Math.max(n.w, cardW);
  const over = (w - n.w) / 2;
  const cappedOver = Math.min(over, cap);
  w = n.w + cappedOver * 2;
  const h = n.h + gap + cardH;
  return { x: n.x - cappedOver, y: n.y, w, h };
}
const cappedRects = ids.map((id) => ({ id, ...cappedCardRect(nodes[id], 8) }));
console.log(`CAPPED(8) card overlaps pad14: ${countOverlaps(cappedRects, 14)}  pad4: ${countOverlaps(cappedRects, 4)}`);

// ---- run the REAL router and time it ----
function sanitize(id, x, y, w, h) {
  return { id, x: Math.round(x), y: Math.round(y), width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
}
function buildGraph(rectFn, buffer) {
  const children = ids.map((id) => { const r = rectFn(id); return sanitize(id, r.x, r.y, r.w, r.h); });
  const es = edges.filter((e) => !GROUP.has(e.from) && !GROUP.has(e.to) && nodes[e.from] && nodes[e.to])
                  .map((e) => ({ id: e.id, source: e.from, target: e.to }));
  return { children, es };
}
async function run(label, rectFn, buffer) {
  const { children, es } = buildGraph(rectFn, buffer);
  const graph = { id: 'root', children, edges: es };
  const t0 = performance.now();
  let routed = 0, threw = false;
  try {
    const routes = await routeEdges(graph, {
      routingType: 'orthogonal', shapeBufferDistance: buffer,
      idealNudgingDistance: 16, nudgeOrthogonalSegmentsConnectedToShapes: true,
    });
    routed = routes.size;
  } catch (e) { threw = true; }
  const ms = (performance.now() - t0).toFixed(0);
  console.log(`  [${label}] buffer=${buffer} -> ${ms}ms routed=${routed}/${es.length} threw=${threw}`);
}

await init();
console.log('\n--- router timings (warm) ---');
// warmup
await run('warmup', (id) => nodes[id], 14);
await run('BOX', (id) => nodes[id], 14);
await run('CARD(full infl)', (id) => cardRect(nodes[id]), 14);
await run('CARD buffer=4', (id) => cardRect(nodes[id]), 4);
await run('CARD capped8 buf14', (id) => cappedCardRect(nodes[id], 8), 14);
await run('CARD capped8 buf4', (id) => cappedCardRect(nodes[id], 8), 4);
