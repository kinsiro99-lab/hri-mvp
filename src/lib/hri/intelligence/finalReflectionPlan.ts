/**
 * HRI Architecture Fix Gate — Reflection Plan.
 *
 * Sits between the deterministic FinalExperienceGrounding
 * (finalExperienceComposer.ts — unchanged in shape by this Gate) and
 * the phraser (finalExperiencePhraser.ts). Pure selection, no LLM call,
 * no new marker list: narrows the full grounding down to ONE preferred
 * discovery direction plus a small set of REAL verbatim anchors, so the
 * phraser's freedom is about HOW to say it, never WHAT pile of material
 * to pick from — closing the gap the Architecture Audit found between
 * "free generation" and a content-blind fallback.
 *
 * Anchor precision (Design Gate correction #2): ContextElement/
 * ContextRelation's own evidenceRefs[].sourceText is a string the
 * Semantic Interpreter (an LLM, contextFirstSemanticAdapter.ts) wrote
 * when it PROPOSED that element/relation — it is not the user's literal
 * words, even though it is meant to summarize them. This file never
 * treats .sourceText as verbatim. It only ever reads evidenceRefs[].turn
 * as a pointer, then looks up that turn's REAL text in the raw
 * EvidenceItem[] (prototypeEvidence) — the one place actual user words
 * are stored unmodified — and only when that item's act is not
 * "confirmation" (Design Gate part A: a bare "그래" is never a valid
 * anchor for new material).
 *
 * Preferred-not-forced (Design Gate correction #1): every discovery
 * direction below requires a REAL resolved anchor. If none can be
 * found, this moves to the next direction in priority order, and
 * finally to "explicit-only" — it never fabricates or stretches for an
 * anchor just to keep a "richer" discovery type alive. The phraser
 * prompt (finalExperiencePhraser.ts) additionally frames whatever
 * direction IS returned here as a preference, not an obligation, so a
 * thin connection can still be declined by the model itself.
 */
import type { EvidenceItem } from "../v2/questionCorePrototype";
import type { ContextGraph, ContextElement, RelationType, RelationProvenance } from "../context/types";
import type { DiscoverySignal, FinalExperienceGrounding } from "./finalExperienceTypes";

export type ReflectionPlan = {
  /** Full grounding, unchanged — still shown to the phraser for context.
   *  This Plan narrows what's PREFERRED, never what's visible. */
  grounding: FinalExperienceGrounding;
  /** Real, verbatim EvidenceItem text only (never a ContextGraph
   *  paraphrase) — see this file's own doc above. Empty only when the
   *  session has no active, non-confirmation evidence at all. */
  anchorEvidence: string[];
  primaryDiscovery: DiscoverySignal | "explicit-only";
  /** Only set when primaryDiscovery is "relation" or "structure". */
  primaryRelationType?: RelationType;
  /** User-Stated Relation Gate — only set when primaryDiscovery is
   *  "relation" (tryStructure's own relation branch is untouched by this
   *  Gate — see its own doc for why hasTension's lexical-contrast case
   *  has no real ContextRelation, hence no provenance, behind it).
   *  Passed straight through from the winning ContextRelation, never
   *  re-derived here. See RelationProvenance's own doc for what "user-
   *  stated" does and does not mean — never objective/world causality. */
  primaryRelationProvenance?: RelationProvenance;
  /** Only set when primaryDiscovery is "open". */
  unresolvedFocus?: string;
};

/** The one place this file resolves a graph-side turn pointer back to
 *  real user words. Excludes confirmation-only and superseded evidence
 *  — never a valid anchor for new material. */
function realText(turn: number, evidence: EvidenceItem[]): string | null {
  const item = evidence.find((e) => e.turn === turn && e.status === "active" && e.act !== "confirmation");
  return item ? item.text : null;
}

function anchorsForElement(el: ContextElement, evidence: EvidenceItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ref of el.evidenceRefs) {
    const t = realText(ref.turn, evidence);
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

function liveRelations(graph: ContextGraph) {
  const activeIds = new Set(graph.elements.filter((e) => e.active).map((e) => e.id));
  return graph.relations.filter((r) => r.status !== "resolved" && activeIds.has(r.from) && activeIds.has(r.to));
}

function tryRelation(graph: ContextGraph, evidence: EvidenceItem[]): { anchor: string[]; type: RelationType; provenance: RelationProvenance } | null {
  for (const r of liveRelations(graph)) {
    const fromEl = graph.elements.find((e) => e.id === r.from);
    const toEl = graph.elements.find((e) => e.id === r.to);
    if (!fromEl || !toEl) continue;
    const fromAnchor = anchorsForElement(fromEl, evidence)[0];
    const toAnchor = anchorsForElement(toEl, evidence)[0];
    if (fromAnchor && toAnchor && fromAnchor !== toAnchor) {
      return { anchor: [fromAnchor, toAnchor], type: r.type, provenance: r.provenance };
    }
  }
  return null;
}

function tryChange(graph: ContextGraph, evidence: EvidenceItem[]): string[] | null {
  for (const el of graph.elements.filter((e) => e.active && e.evidenceRefs.length >= 2)) {
    const anchors = anchorsForElement(el, evidence);
    if (anchors.length >= 2) return anchors.slice(0, 2);
  }
  return null;
}

/** Deliberately narrower than composer.ts's own hasTension (which also
 *  accepts a bare lexical contrast marker like "하지만" between two
 *  verbatim lines, with no element/relation object behind it at all).
 *  That lexical-only case has no real element/turn to anchor precisely
 *  — exactly the "weak evidence" case correction #1 says must degrade
 *  rather than be forced into a discovery type. */
function tryStructure(graph: ContextGraph, evidence: EvidenceItem[]): { anchor: string[]; type: RelationType } | null {
  for (const r of liveRelations(graph).filter((r) => r.type === "conflictsWith" || r.type === "limits")) {
    const fromEl = graph.elements.find((e) => e.id === r.from);
    const toEl = graph.elements.find((e) => e.id === r.to);
    if (!fromEl || !toEl) continue;
    const fromAnchor = anchorsForElement(fromEl, evidence)[0];
    const toAnchor = anchorsForElement(toEl, evidence)[0];
    if (fromAnchor && toAnchor && fromAnchor !== toAnchor) return { anchor: [fromAnchor, toAnchor], type: r.type };
  }
  const conflicted = graph.elements.find((e) => e.active && e.status === "conflicted");
  if (conflicted) {
    const anchor = anchorsForElement(conflicted, evidence)[0];
    if (anchor) return { anchor: [anchor], type: "conflictsWith" };
  }
  return null;
}

function tryOpen(graph: ContextGraph, evidence: EvidenceItem[]): { anchor?: string; reason: string } | null {
  const point = graph.unresolved[0];
  if (!point || !point.reason) return null;
  const anchor = point.grounding.map((g) => realText(g.turn, evidence)).find((t): t is string => Boolean(t));
  return { anchor, reason: point.reason };
}

function fallbackAnchor(evidence: EvidenceItem[]): string[] {
  const real = evidence.filter((e) => e.status === "active" && e.act !== "confirmation");
  const last = real[real.length - 1];
  return last ? [last.text] : [];
}

/**
 * Priority order matches DiscoverySignal's own declared order in
 * finalExperienceTypes.ts (relation, change, structure, open) — no new
 * ranking invented for this Gate. Each attempt independently requires a
 * real resolved anchor (see each try* function); the first one that
 * finds one wins. Falls to "explicit-only" only when none do.
 */
export function buildReflectionPlan(
  grounding: FinalExperienceGrounding,
  evidence: EvidenceItem[] | undefined,
  graph: ContextGraph | undefined,
): ReflectionPlan {
  const ev = evidence ?? [];
  const g = graph ?? { elements: [], relations: [], unresolved: [], updateLog: [] };

  const relation = tryRelation(g, ev);
  if (relation) {
    return {
      grounding,
      anchorEvidence: relation.anchor,
      primaryDiscovery: "relation",
      primaryRelationType: relation.type,
      primaryRelationProvenance: relation.provenance,
    };
  }
  const change = tryChange(g, ev);
  if (change) {
    return { grounding, anchorEvidence: change, primaryDiscovery: "change" };
  }
  const structure = tryStructure(g, ev);
  if (structure) {
    return { grounding, anchorEvidence: structure.anchor, primaryDiscovery: "structure", primaryRelationType: structure.type };
  }
  const open = tryOpen(g, ev);
  if (open) {
    return { grounding, anchorEvidence: open.anchor ? [open.anchor] : [], primaryDiscovery: "open", unresolvedFocus: open.reason };
  }
  return { grounding, anchorEvidence: fallbackAnchor(ev), primaryDiscovery: "explicit-only" };
}
