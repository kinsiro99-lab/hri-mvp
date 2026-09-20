/**
 * PresentReality Pure Projection Gate.
 *
 * Pure projection over an already-validated ContextGraph + the raw
 * EvidenceItem[] it was built from — same "no interpretation"
 * discipline types.ts's hypothesesFromGraph already established for
 * Hypothesis ("Pure projection, no interpretation... called fresh off
 * the current ContextGraph every turn"). Computes nothing new: every
 * field is a sort/filter/passthrough of data already validated
 * elsewhere (context/validator.ts's V1-V10 rules for elements/
 * relations; the same recency comparator intelligenceCore.ts's
 * mostRecentActiveElement already uses for "most recent active"). No
 * relation is ever created here — relations are read straight off
 * graph.relations, never derived from co-occurrence, lexical contrast,
 * or any other heuristic. No movement field, no emotion/motive/cause/
 * personality field of any kind, no LLM call.
 *
 * This file is standalone by design (Root Cause Reset audit's own
 * finding: no existing object in the Evidence -> Discovery/Plan ->
 * Response/Mirror chain represents an aggregated present-state — see
 * that audit's report). It is not imported by decideResponse(),
 * responsePhraser.ts, buildReflectionPlan(), finalExperiencePhraser.ts,
 * or controller.ts — this Gate tests the semantic object only.
 *
 * realText()/sourceRefFor()/sortByRecency() below are intentionally
 * small local reimplementations of logic that already exists in
 * finalReflectionPlan.ts (realText/anchorsForElement) and
 * intelligenceCore.ts (mostRecentActiveElement's own sort) — reused
 * verbatim by design, not imported, so this Gate's diff stays isolated
 * to this one new file and touches zero existing files.
 */
import type { ContextGraph, ContextElement, ContextRelation, UnresolvedPoint } from "../context/types";
import type { EvidenceItem } from "../v2/questionCorePrototype";

export type PresentRealitySourceRef = {
  elementId: string;
  /** Real, verbatim EvidenceItem text only (never a ContextGraph
   *  paraphrase) — resolved the same way finalReflectionPlan.ts's own
   *  realText()/anchorsForElement() already do: evidenceRefs[].turn is
   *  a pointer, looked up in the raw EvidenceItem[], excluding
   *  superseded and confirmation-only turns. */
  evidenceTexts: string[];
};

export type PresentReality = {
  /** Exactly one, or null when no active element exists yet — the most
   *  recently touched active ContextElement. */
  foreground: ContextElement | null;
  /** Every other active ContextElement, unranked beyond the recency
   *  ordering already used to pick foreground — no new interpretation. */
  context: ContextElement[];
  /** graph.relations, filtered to status !== "resolved" and to
   *  relations connecting two currently-active elements (same
   *  consistency filter finalExperienceComposer.ts's own
   *  buildFinalExperienceGrounding already applies) — never a new or
   *  re-typed relation. */
  relations: ContextRelation[];
  /** graph.unresolved, unfiltered passthrough. */
  unresolved: UnresolvedPoint[];
  /** One entry per foreground/context element (in the same order:
   *  foreground first, then context), so every element PresentReality
   *  names remains traceable to real source Evidence. */
  sourceRefs: PresentRealitySourceRef[];
};

/** Same exclusion rule as finalReflectionPlan.ts's own realText() — a
 *  bare confirmation ("그래"/"응") is never a valid anchor for new
 *  material, and only ACTIVE (non-superseded) evidence counts. */
function realText(turn: number, evidence: EvidenceItem[]): string | null {
  const item = evidence.find((e) => e.turn === turn && e.status === "active" && e.act !== "confirmation");
  return item ? item.text : null;
}

function sourceRefFor(el: ContextElement, evidence: EvidenceItem[]): PresentRealitySourceRef {
  const seen = new Set<string>();
  const evidenceTexts: string[] = [];
  for (const ref of el.evidenceRefs) {
    const t = realText(ref.turn, evidence);
    if (t && !seen.has(t)) {
      seen.add(t);
      evidenceTexts.push(t);
    }
  }
  return { elementId: el.id, evidenceTexts };
}

/** Same recency comparator intelligenceCore.ts's own
 *  mostRecentActiveElement/decideResponse's Explore-branch selection
 *  already use — most-recently-touched first, confidence as tiebreaker. */
function sortByRecency(elements: ContextElement[]): ContextElement[] {
  return [...elements].sort((a, b) => {
    const aTurn = a.evidenceRefs[a.evidenceRefs.length - 1]?.turn ?? 0;
    const bTurn = b.evidenceRefs[b.evidenceRefs.length - 1]?.turn ?? 0;
    if (aTurn !== bTurn) return bTurn - aTurn;
    return b.confidence - a.confidence;
  });
}

export function buildPresentReality(graph: ContextGraph, evidence: EvidenceItem[]): PresentReality {
  const active = sortByRecency(graph.elements.filter((e) => e.active));
  const foreground = active[0] ?? null;
  const context = active.slice(1);

  const activeIds = new Set(active.map((e) => e.id));
  const relations = graph.relations.filter(
    (r) => r.status !== "resolved" && activeIds.has(r.from) && activeIds.has(r.to),
  );

  const unresolved = graph.unresolved;

  const sourceRefs = active.map((el) => sourceRefFor(el, evidence));

  return { foreground, context, relations, unresolved, sourceRefs };
}
