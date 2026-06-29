#!/usr/bin/env node
/* =====================================================================
   trust-report.mjs — classify every claim in docs/flowmap/_bundle.mmd
   into trust tiers so a reader knows what is machine-PROVEN vs prose.

   Usage:
     node tools/flowmap/trust-report.mjs          # human-readable
     node tools/flowmap/trust-report.mjs --json   # machine-readable

   Exit: 0 always (pure reporting, never a gate).

   Trust tiers:
     VERIFIED          — enforced by flowmap:gate; mismatch blocks CI.
     PARTIALLY_VERIFIED— documented but not enforced (prose types →
                         the gate calls these "documented holes" and skips
                         them with normType → null; no false mismatches,
                         no enforcement either).
     ADVISORY          — desc= strings; free prose, never checked.
     UNVERIFIED        — edges; gate emits differences as warnings only.

   Gated-kinds source (verified from code, not guessed):
     MEMBER_GATED  = {class, function, hook, type}
       → diff-core.mjs line 21: `const MEMBER_GATED = new Set([...])` (not exported)
       → extract.mjs line 35:   `const GATED        = new Set([...])` (same set)
       Member NAMES are enforced for these kinds.
     ARITY_GATED   = {class, function, hook}
       → skeleton.mjs: `export const ARITY_GATED_KINDS = new Set([...])`
       Arity, returnsValue, and clean param/return TYPES are enforced for
       these kinds (type-kind members have names checked but no arity gate).
   ===================================================================== */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseMmd } from '../buildspec/mmd-parse.mjs';
import {
  ARITY_GATED_KINDS,  // Set(['class', 'function', 'hook'])
  gateParent,         // resolves real (non-group) parent, mirroring gate logic
  ifaceParams,        // flattens iface.accepts[] into [{name,type}]
  normType,           // null for prose types, canonical string for clean types
  returnTypeOf,       // 'void' | clean-string | null(prose)
} from '../buildspec/skeleton.mjs';

// ── Gated-kinds constants ─────────────────────────────────────────────
// Not exported from diff-core.mjs; confirmed equal to extract.mjs GATED.
// diff-core.mjs line 21: const MEMBER_GATED = new Set(['class', 'function', 'hook', 'type']);
// extract.mjs  line 35:  const GATED        = new Set(['class', 'function', 'hook', 'type']);
const MEMBER_GATED = new Set(['class', 'function', 'hook', 'type']);

const __dir = dirname(fileURLToPath(import.meta.url));
const BUNDLE = resolve(__dir, '../../docs/flowmap/_bundle.mmd');

// ── Core classification ───────────────────────────────────────────────

/**
 * Walk every real (non-group) node and every edge, and tally claims into
 * four trust buckets. Returns raw counters; summarize() wraps them for output.
 *
 * @param {{ nodes, edges, fm, groups }} model  parseMmd result
 * @returns {{ verified, partiallyVerified, advisory, unverified }}
 */
function classify(model) {
  const { nodes, edges, fm } = model;

  const verified = {
    existence: 0,     // node id is in the spec; gate would report "unbuilt" if absent in code
    kind: 0,          // %% kind directive; gate checks kind equality
    parent: 0,        // %% parent (drill-in, non-group); gate checks parent equality
    memberName: 0,    // interface name declared in MEMBER_GATED node; gate checks presence
    arity: 0,         // parameter count for ARITY_GATED members; gate checks equality
    returnsValue: 0,  // void vs value flag for ARITY_GATED members; gate checks equality
    paramType: 0,     // clean (non-prose) param type for ARITY_GATED members; gate compares
    returnType: 0,    // clean (non-prose) return type for ARITY_GATED members; gate compares
  };

  const partiallyVerified = {
    // normType(raw) === null means the spec wrote a prose/object-literal type.
    // The gate skips these to avoid false mismatches ("documented holes").
    // They are documented intent, but receive zero enforcement.
    paramTypeProse: 0,
    returnTypeProse: 0,
  };

  const advisory = {
    // desc= is pure human-readable text; no tool ever checks its accuracy.
    desc: 0,
  };

  const unverified = {
    // Edges are spec call-order; extracted edges are import relations.
    // diff-core.mjs explicitly calls these "Non-blocking (warnings)".
    edge: 0,
  };

  for (const id of Object.keys(nodes)) {
    const node = nodes[id];
    if (node.group) continue; // subgraph containers are layout, not spec nodes

    // ── VERIFIED: existence, kind, parent ──────────────────────────
    verified.existence++;
    if (node.kind) verified.kind++;
    if (gateParent(model, id)) verified.parent++;

    const nodeFm = fm[id];
    if (!nodeFm) continue;

    // ── ADVISORY: desc ─────────────────────────────────────────────
    if (nodeFm.description) advisory.desc++;

    // ── MEMBER-LEVEL claims (only for gated kinds) ─────────────────
    if (!MEMBER_GATED.has(node.kind)) continue;

    for (const iface of nodeFm.interfaces || []) {
      const memberName = (iface.name || '').trim();
      if (!memberName) continue;

      // VERIFIED: member name present in spec → gate checks it exists in code
      verified.memberName++;

      // Arity-gated kinds additionally check arity, return-ness, and types
      if (!ARITY_GATED_KINDS.has(node.kind)) continue;

      // VERIFIED: arity (parameter count)
      const params = ifaceParams(iface.accepts);
      verified.arity++;

      // VERIFIED: returnsValue (void vs value)
      verified.returnsValue++;

      // Param types: clean → VERIFIED; prose → PARTIALLY_VERIFIED
      for (const param of params) {
        if (normType(param.type) !== null) {
          verified.paramType++;
        } else {
          partiallyVerified.paramTypeProse++;
        }
      }

      // Return type: 'void'/clean → VERIFIED; null (prose/union-spread) → PARTIALLY_VERIFIED
      const rt = returnTypeOf(iface.returns);
      if (rt !== null) {
        verified.returnType++;
      } else {
        partiallyVerified.returnTypeProse++;
      }
    }
  }

  // Edges: always UNVERIFIED
  unverified.edge = edges.length;

  return { verified, partiallyVerified, advisory, unverified };
}

// ── Output builder ────────────────────────────────────────────────────

function buildReport(model, tiers) {
  const { nodes, edges } = model;
  const totalNodes = Object.values(nodes).filter((n) => !n.group).length;
  const totalEdges = edges.length;

  const { verified, partiallyVerified, advisory, unverified } = tiers;

  const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

  return {
    map: 'docs/flowmap/_bundle.mmd',
    totals: {
      nodes: totalNodes,
      edges: totalEdges,
    },
    tiers: {
      VERIFIED: {
        count: sum(verified),
        meaning:
          'Enforced by flowmap:gate — a mismatch between spec and extracted code blocks CI.',
        breakdown: {
          'node existence (gate: unbuilt / unplanned errors)': verified.existence,
          'node kind (gate: kind mismatch error)': verified.kind,
          'node parent drill-in (gate: parent mismatch error)': verified.parent,
          'member names in MEMBER_GATED kinds (gate: missing member error)': verified.memberName,
          'member arity in ARITY_GATED kinds (gate: arity mismatch error)': verified.arity,
          'member returnsValue in ARITY_GATED kinds (gate: return mismatch error)': verified.returnsValue,
          'clean param types in ARITY_GATED kinds (gate: param type mismatch error)': verified.paramType,
          'clean return types in ARITY_GATED kinds (gate: return type mismatch error)': verified.returnType,
        },
      },
      PARTIALLY_VERIFIED: {
        count: sum(partiallyVerified),
        meaning:
          'i0 param/return types written as prose or object-literals — normType() returns null, the gate counts them as "documented holes" and skips comparison to avoid false positives. Documented intent, zero enforcement.',
        breakdown: {
          'prose/object-literal param types (normType → null)': partiallyVerified.paramTypeProse,
          'prose/union-spread return types (returnTypeOf → null)': partiallyVerified.returnTypeProse,
        },
      },
      ADVISORY: {
        count: sum(advisory),
        meaning:
          'Free-text desc= strings — never machine-checked; useful human context only.',
        breakdown: {
          'desc= strings': advisory.desc,
        },
      },
      UNVERIFIED: {
        count: sum(unverified),
        meaning:
          'All edges — the gate treats edge differences as non-blocking warnings only (spec edges are semantic call-order; extracted edges are import relations — not a 1:1 mapping).',
        breakdown: {
          'edges (solid + dotted)': unverified.edge,
        },
      },
    },
  };
}

// ── Renderers ─────────────────────────────────────────────────────────

function printText(data) {
  const { map, totals, tiers } = data;
  const nl = () => console.log('');
  const ln = (s) => console.log(s);

  ln('=== flowmap trust report ===');
  nl();
  ln(`Map   : ${map}`);
  ln(`Nodes : ${totals.nodes}  (real, non-group)`);
  ln(`Edges : ${totals.edges}`);
  nl();
  ln('Claim counts by trust tier:');
  nl();

  for (const [tier, info] of Object.entries(tiers)) {
    ln(`${tier}  (${info.count} facts)`);
    for (const [label, count] of Object.entries(info.breakdown)) {
      ln(`  ${String(count).padStart(5)}  ${label}`);
    }
    nl();
  }

  ln('Legend:');
  nl();
  for (const [tier, info] of Object.entries(tiers)) {
    ln(`  ${tier}:`);
    // wrap meaning at ~72 chars
    const words = info.meaning.split(' ');
    let line = '    ';
    for (const w of words) {
      if (line.length + w.length + 1 > 76 && line.trim()) {
        ln(line);
        line = '    ' + w + ' ';
      } else {
        line += w + ' ';
      }
    }
    if (line.trim()) ln(line);
    nl();
  }
}

// ── Entry point ───────────────────────────────────────────────────────

function main() {
  const isJson = process.argv.includes('--json');

  const text = readFileSync(BUNDLE, 'utf8');
  const model = parseMmd(text);
  const tiers = classify(model);
  const data = buildReport(model, tiers);

  if (isJson) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  } else {
    printText(data);
  }

  process.exit(0);
}

main();
