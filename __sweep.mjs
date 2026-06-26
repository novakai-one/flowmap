import fs from 'node:fs';
import { init, routeEdges } from '@mr_mint/elkjs-libavoid';
const F = '/sessions/great-trusting-pascal/mnt/flowmap/.claude/worktrees/vigilant-pike-7136af/novakai.mmd';
const text = fs.readFileSync(F, 'utf8');
const nodes = {}; const edges = []; let maxE = 0;
for (const raw of text.split('\n')) {
  const t = raw.trim(); let m;
  if ((m = t.match(/^%% fm (\w+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (\w+)/))) { nodes[m[1]] = { x:+m[2],y:+m[3],w:+m[4],h:+m[5],shape:m[6] }; continue; }
  if (t.startsWith('%%')) continue;
  if ((m = t.match(/^(\w+)\s*(?:-\.->|==>|-->|---)\s*(?:\|[^|]*\|)?\s*(\w+)/))) edges.push({ id:'e'+ ++maxE, from:m[1], to:m[2] });
}
const GROUP = new Set(Object.keys(nodes).filter((id)=>nodes[id].shape==='group'));
const ids = Object.keys(nodes).filter((id)=>!GROUP.has(id));
function cardRect(n){ const w=Math.max(n.w,240); return { x:n.x-(w-n.w)/2, y:n.y, w, h:n.h+6+120 }; }
function san(id,x,y,w,h){ return { id, x:Math.round(x), y:Math.round(y), width:Math.max(1,Math.round(w)), height:Math.max(1,Math.round(h)) }; }
const es = edges.filter((e)=>!GROUP.has(e.from)&&!GROUP.has(e.to)&&nodes[e.from]&&nodes[e.to]).map((e)=>({id:e.id,source:e.from,target:e.to}));
async function run(buffer){
  const children = ids.map((id)=>{const r=cardRect(nodes[id]);return san(id,r.x,r.y,r.w,r.h);});
  const graph={id:'root',children,edges:es};
  const t0=performance.now(); let routed=0,threw=false;
  try{ const r=await routeEdges(graph,{routingType:'orthogonal',shapeBufferDistance:buffer,idealNudgingDistance:16,nudgeOrthogonalSegmentsConnectedToShapes:true}); routed=r.size; }catch(e){threw=true;}
  console.log(`buffer=${String(buffer).padStart(2)} -> ${(performance.now()-t0).toFixed(0).padStart(5)}ms routed=${routed}/${es.length} threw=${threw}`);
}
await init();
await run(14); // warm + baseline repeat
for (const b of [14,12,10,8,6,4,2]) await run(b);
