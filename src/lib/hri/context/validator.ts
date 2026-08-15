/**
 * Context Quality Validator — Sprint12-D §13.
 *
 * Pure functions only. The Validator NEVER generates text, NEVER
 * proposes a question, and NEVER decides ASK/REFLECT — it only
 * classifies a proposed InterpreterOutput as ACCEPT /
 * ACCEPT_WITH_UNCERTAINTY / REJECT.
 *
 * Explicit limitation (Sprint12-D §14, must stay visible): none of
 * V1-V7 can verify whether a proposal is semantically TRUE. Without a
 * real Semantic Provider, "unsupported inference" (V2) and "reference
 * confidence" (V4) can only be checked structurally (does the grounding
 * text exist? does it contain more than a bare pronoun?) — never
 * "does this correctly describe what the user meant." Building a
 * bigger rule engine here to compensate would just recreate
 * contextShadow.ts's regex approach one layer up, which Sprint12-B/C
 * already showed hits a ceiling (paraphrase, novel phrasing). This
 * Validator is deliberately shallow by design, not by oversight.
 */
import {
  type ContextElement,
  type ContextGraph,
  type ContextRelation,
  type ConversationTurn,
  type ElementKind,
  type InterpreterOutput,
  type ProposedElement,
  type ProposedRelation,
  type ProposedUnresolved,
  type ProposedUpdate,
} from "./types";
import { CONTEXT_CONFIDENCE_POLICY } from "./confidencePolicy";

export type ValidationResult = "ACCEPT" | "ACCEPT_WITH_UNCERTAINTY" | "REJECT";

export type ValidationIssue = {
  rule: "V1" | "V2" | "V3" | "V4" | "V5" | "V6" | "V7";
  severity: "reject" | "uncertain";
  target: string;
  message: string;
};

export type ValidationReport = {
  result: ValidationResult;
  issues: ValidationIssue[];
};

/* ---- shared, small, structural helpers (not a semantic engine) ---- */

function tokenSet(text: string): Set<string> {
  return new Set(text.split(/[\s,.!?"']+/).filter((w) => w.length >= 1));
}
function overlapRatio(a: string, b: string): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const w of sa) if (sb.has(w)) shared++;
  return shared / Math.min(sa.size, sb.size);
}

const BARE_DEMONSTRATIVE = /^(그것|그게|그 일|그 것|이것|저것|그거|저거)\s*(은|는|이|가|을|를)?\s*(좀\s*)?(걸린다|걸려|같다|이다)?\.?$/;
/** Deliberately tiny and literal — a handful of common bare Korean
 *  demonstratives with (almost) no other content, not a pronoun
 *  parser. True only when the ENTIRE grounding text is essentially
 *  just "that (thing)", which is exactly the case a Semantic
 *  Provider needs real context to resolve. */
function isBareDemonstrativeReference(text: string): boolean {
  return BARE_DEMONSTRATIVE.test(text.trim());
}

function findTurnText(turns: ConversationTurn[], turn: number): string | undefined {
  return turns.find((t) => t.turn === turn)?.text;
}

/* ---- V1: Grounding validation ---- */
export function validateGrounding(
  groundingTurn: number,
  groundingText: string,
  recentTurns: ConversationTurn[],
): ValidationIssue[] {
  const actual = findTurnText(recentTurns, groundingTurn);
  if (actual === undefined) {
    return [{ rule: "V1", severity: "reject", target: `turn ${groundingTurn}`, message: "grounding turn not present in recentTurns" }];
  }
  if (!actual.includes(groundingText) && !groundingText.includes(actual)) {
    // Neither is a substring of the other — the cited text cannot be
    // traced back to what was actually said this turn.
    return [{ rule: "V1", severity: "reject", target: `turn ${groundingTurn}`, message: `groundingText "${groundingText}" not traceable to actual turn text "${actual}"` }];
  }
  return [];
}

/* ---- V2: Unsupported inference (structural smell test only) ---- */
export function validateUnsupportedInference(description: string, groundingText: string, kind: "explicit" | "inferred"): ValidationIssue[] {
  const overlap = overlapRatio(description, groundingText);
  if (overlap === 0) {
    return [{ rule: "V2", severity: "reject", target: description, message: "description shares no content with its own grounding text" }];
  }
  if (kind === "explicit" && overlap < 0.5) {
    return [{ rule: "V2", severity: "uncertain", target: description, message: `claimed explicit but description barely overlaps grounding text (overlap=${overlap.toFixed(2)})` }];
  }
  return [];
}

/* ---- V3: Contradiction / revision integrity ---- */
export function validateContradictionIntegrity(
  proposedElement: ProposedElement,
  graph: ContextGraph,
  updatedElements: ProposedUpdate[],
): ValidationIssue[] {
  for (const existing of graph.elements) {
    if (!existing.active || existing.kind !== proposedElement.kind) continue;
    const overlap = overlapRatio(proposedElement.description, existing.description);
    if (overlap >= CONTEXT_CONFIDENCE_POLICY.DUPLICATE_MERGE_MIN) {
      const referencedAsUpdate = updatedElements.some((u) => u.targetElementId === existing.id);
      if (!referencedAsUpdate) {
        return [{
          rule: "V3",
          severity: "uncertain",
          target: proposedElement.localRef,
          message: `strongly overlaps existing active element ${existing.id} but was proposed as an independent new fact instead of an update/relation referencing it`,
        }];
      }
    }
  }
  return [];
}

/* ---- V4: Reference confidence ---- */
export function validateReferenceConfidence(
  groundingText: string,
  confidence: number,
): ValidationIssue[] {
  if (isBareDemonstrativeReference(groundingText) && confidence >= CONTEXT_CONFIDENCE_POLICY.GROUNDED_MIN) {
    return [{ rule: "V4", severity: "uncertain", target: groundingText, message: "bare demonstrative reference asserted at grounded-tier confidence — antecedent not resolvable from text alone" }];
  }
  return [];
}

/* ---- V5: Relation / tension integrity ---- */
export function validateRelationIntegrity(
  relation: ProposedRelation,
  graph: ContextGraph,
  newElements: ProposedElement[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const resolve = (ref: string): { confidence: number } | undefined => {
    const existing = graph.elements.find((e) => e.id === ref);
    if (existing) return { confidence: existing.confidence };
    const local = newElements.find((e) => e.localRef === ref);
    if (local) return { confidence: local.confidence };
    return undefined;
  };
  const from = resolve(relation.from);
  const to = resolve(relation.to);
  if (!from || !to) {
    issues.push({ rule: "V5", severity: "reject", target: `${relation.from}->${relation.to}`, message: "relation endpoint does not exist in graph or in this batch's newElements" });
    return issues;
  }
  const maxAllowed = Math.min(from.confidence, to.confidence);
  if (relation.confidence > maxAllowed) {
    issues.push({ rule: "V5", severity: "reject", target: `${relation.from}->${relation.to}`, message: `relation.confidence (${relation.confidence}) exceeds min(endpoint confidences) (${maxAllowed}) — invariant violated` });
  }
  return issues;
}

/* ---- V6: Context drift (silent deletion guard) ---- */
export function validateNoSilentDeletion(
  before: ContextElement[],
  after: ContextElement[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const b of before) {
    if (!b.active) continue;
    const a = after.find((e) => e.id === b.id);
    if (!a) {
      issues.push({ rule: "V6", severity: "reject", target: b.id, message: "active element removed from graph entirely — deprioritize/revise/conflict must be used instead of deletion" });
    }
  }
  return issues;
}

/* ---- V7: Duplication / unsafe merge ---- */
export function validateDuplication(
  proposedElement: ProposedElement,
  graph: ContextGraph,
): ValidationIssue[] {
  let best = 0;
  let bestId: string | undefined;
  for (const existing of graph.elements) {
    if (!existing.active || existing.kind !== proposedElement.kind) continue;
    const overlap = overlapRatio(proposedElement.description, existing.description);
    if (overlap > best) { best = overlap; bestId = existing.id; }
  }
  if (best >= CONTEXT_CONFIDENCE_POLICY.DUPLICATE_MERGE_MIN) {
    // Likely the same thing — the caller (adapter/merge step) should
    // route this as reinforce, not create. Flagged, not force-merged
    // here (Validator doesn't merge, it only classifies).
    return [{ rule: "V7", severity: "uncertain", target: proposedElement.localRef, message: `overlap ${best.toFixed(2)} with existing element ${bestId} — likely duplicate, should be proposed as reinforce/specify instead of create` }];
  }
  if (best >= CONTEXT_CONFIDENCE_POLICY.DUPLICATE_UNCERTAIN_MIN) {
    return [{ rule: "V7", severity: "uncertain", target: proposedElement.localRef, message: `ambiguous overlap ${best.toFixed(2)} with existing element ${bestId} — kept separate, relation-level uncertainty recommended rather than forced merge` }];
  }
  return [];
}

/* =========================================================
 * Top-level aggregation.
 * ========================================================= */
export function validateInterpretation(
  output: InterpreterOutput,
  graph: ContextGraph,
  recentTurns: ConversationTurn[],
): ValidationReport {
  const issues: ValidationIssue[] = [];

  for (const el of output.newElements) {
    issues.push(...validateGrounding(el.groundingTurn, el.groundingText, recentTurns));
    issues.push(...validateUnsupportedInference(el.description, el.groundingText, el.confidence >= CONTEXT_CONFIDENCE_POLICY.GROUNDED_MIN ? "explicit" : "inferred"));
    issues.push(...validateContradictionIntegrity(el, graph, output.updatedElements));
    issues.push(...validateReferenceConfidence(el.groundingText, el.confidence));
    issues.push(...validateDuplication(el, graph));
  }

  for (const u of output.updatedElements) {
    issues.push(...validateGrounding(u.groundingTurn, u.groundingText, recentTurns));
    if (!graph.elements.some((e) => e.id === u.targetElementId)) {
      issues.push({ rule: "V1", severity: "reject", target: u.targetElementId, message: "update targets an element id that does not exist in the graph" });
    }
  }

  for (const r of output.relations) {
    issues.push(...validateGrounding(r.groundingTurn, r.groundingText, recentTurns));
    issues.push(...validateRelationIntegrity(r, graph, output.newElements));
  }

  for (const u of output.unresolvedCandidates) {
    issues.push(...validateGrounding(u.groundingTurn, u.groundingText, recentTurns));
  }

  const hasReject = issues.some((i) => i.severity === "reject");
  const hasUncertain = issues.some((i) => i.severity === "uncertain");
  const result: ValidationResult = hasReject ? "REJECT" : hasUncertain ? "ACCEPT_WITH_UNCERTAINTY" : "ACCEPT";

  return { result, issues };
}
