/**
 * Context Quality Validator — Sprint12-D §13, restructured Sprint12-E3.
 *
 * Pure functions only. The Validator NEVER generates text, NEVER
 * proposes a question, and NEVER decides ASK/REFLECT.
 *
 * Sprint12-E3 §2 architecture split (must stay visible): Semantic
 * Provider = meaning judgment. Validator = structural / grounding /
 * lifecycle / provenance / endpoint integrity only. Evaluation =
 * Context understanding quality. Sprint12-E2's V9 blurred the second
 * and third of these — it tried to judge whether an identity claim was
 * semantically TRUE via lexical token overlap, which produced both a
 * false reject (continuation claim in a different language than its
 * target — zero token overlap despite being correct) and a false accept
 * (false merge disguised by copying boilerplate from the target's own
 * description into the update note). V9 below no longer computes any
 * overlap: it only checks that a self-declared "uncertainSameElement"
 * identity is honored downstream (kept out of the merge, never treated
 * as settled fact). Whether an identity claim is actually TRUE is now
 * exclusively an Evaluation Safety-invariant concern (evaluationCases.ts),
 * never a Validator gate — see the Sprint12-E3 report §G for the full
 * rationale and the false-merge-prevention trade-off this implies.
 *
 * Explicit limitation (Sprint12-D §14, still true): none of these rules
 * can verify whether a proposal is semantically TRUE — only whether it
 * is structurally traceable, internally consistent, and honestly
 * self-reported. Building a bigger rule engine here to compensate would
 * just recreate contextShadow.ts's regex approach one layer up. This
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

export type ValidationIssue = {
  rule: "V1" | "V2" | "V3" | "V4" | "V5" | "V6" | "V7" | "V8" | "V9" | "V10";
  severity: "reject" | "uncertain";
  target: string;
  message: string;
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

/* ---- V8: Current-turn grounding integrity (Sprint12-E2 §14) ----
 * V1 only checks that groundingText traces to SOME turn in the window.
 * It never checked WHICH turn — so a proposal generated while
 * processing turn T could cite turn T-1's text as its sole evidence,
 * meaning nothing in turn T itself actually justified the mutation
 * (Sprint12-E's WEB CASE B last-turn misattribution finding). Exempt:
 * unresolvedCandidates — an open question is allowed to persist without
 * being re-grounded in the newest turn every time. */
export function validateCurrentTurnGrounding(
  groundingTurn: number,
  currentTurn: number,
  target: string,
): ValidationIssue[] {
  if (groundingTurn !== currentTurn) {
    return [{
      rule: "V8",
      severity: "reject",
      target,
      message: `proposal grounded in turn ${groundingTurn} but this interpretation is running for turn ${currentTurn} — no current-turn evidence backs this proposal (historical connection belongs on targetElementId/relation endpoints, not on groundingTurn)`,
    }];
  }
  return [];
}

/* ---- V9: Identity honesty (Sprint12-E3 §10 — structural-only rewrite) ----
 * Sprint12-E2's V9 judged whether an identityRelation claim was TRUE via
 * lexical overlap between the update note and the target's description.
 * That is a semantic judgment in disguise, and it was empirically wrong
 * in both directions (see file header). This V9 makes no attempt to
 * judge truth at all — it only enforces that a self-declared
 * "uncertainSameElement" is actually TREATED as uncertain downstream
 * (flagged here; withheld from merge in evaluationHarness.ts's
 * filterAcceptedProposals — see its own comment). continuation /
 * clarification / revision get no lexical check whatsoever now: the
 * Provider's claim is taken as its own responsibility, and whether that
 * claim was actually correct is measured post-hoc by Evaluation Safety
 * invariants (e.g. WEB CASE B's "friend/work not merged" invariant),
 * never gated here. */
export function validateIdentityRelation(
  update: ProposedUpdate,
): ValidationIssue[] {
  if (update.identityRelation === "uncertainSameElement") {
    return [{
      rule: "V9",
      severity: "uncertain",
      target: update.targetElementId,
      message: `identityRelation "uncertainSameElement" — accepted as a signal but not merged into the graph; identity itself is unresolved, not just evidence quality, so no automatic attribution is made`,
    }];
  }
  return [];
}

/* ---- V10: Relation dependency integrity (Sprint12-E3 §5) ----
 * Proposal-level validation (Sprint12-E3 §4) means a single turn's
 * newElements can now be individually accepted or rejected instead of
 * all-or-nothing. A relation that references a newElement's localRef
 * which was itself rejected this same batch must also be rejected — its
 * endpoint doesn't exist in any graph that will actually be produced.
 * This is pure structural dependency, not a semantic judgment: V5
 * already rejects a relation whose endpoint never existed in the batch
 * at all; V10 covers the case where the endpoint WAS proposed but did
 * not survive its own validation. */
export function validateRelationDependency(
  relation: ProposedRelation,
  rejectedNewElementRefs: Set<string>,
): ValidationIssue[] {
  const badRef = rejectedNewElementRefs.has(relation.from) ? relation.from : rejectedNewElementRefs.has(relation.to) ? relation.to : undefined;
  if (badRef) {
    return [{
      rule: "V10",
      severity: "reject",
      target: `${relation.from}->${relation.to}`,
      message: `relation references ${badRef}, a newElement proposed in this same batch that was itself REJECTed — dependency integrity violated`,
    }];
  }
  return [];
}

/* =========================================================
 * Proposal-level transaction result (Sprint12-E3 §4/§6).
 * ========================================================= */

export type ProposalDecision = "ACCEPT" | "ACCEPT_WITH_UNCERTAINTY" | "REJECT";

export type ProposalValidation<T> = {
  proposal: T;
  decision: ProposalDecision;
  issues: ValidationIssue[];
};

/** Batch-level summary, kept for reporting only (Sprint12-E3 §6) — it
 *  must never force all-or-nothing merge behavior; see
 *  evaluationHarness.ts's filterAcceptedProposals, which merges by
 *  per-proposal decision, not by this status. PARTIAL means at least
 *  one proposal in the batch was accepted (or accepted-with-uncertainty)
 *  and at least one other was rejected — the batch did real, useful
 *  work AND had a problem, both true at once. */
export type InterpretationStatus = "ACCEPT" | "ACCEPT_WITH_UNCERTAINTY" | "PARTIAL" | "REJECT";

export type InterpretationValidationSummary = {
  acceptedCount: number;
  uncertainCount: number;
  rejectedCount: number;
  status: InterpretationStatus;
};

export type InterpretationValidationResult = {
  newElements: ProposalValidation<ProposedElement>[];
  updatedElements: ProposalValidation<ProposedUpdate>[];
  relations: ProposalValidation<ProposedRelation>[];
  unresolvedCandidates: ProposalValidation<ProposedUnresolved>[];
  summary: InterpretationValidationSummary;
};

function decisionFromIssues(issues: ValidationIssue[]): ProposalDecision {
  if (issues.some((i) => i.severity === "reject")) return "REJECT";
  if (issues.some((i) => i.severity === "uncertain")) return "ACCEPT_WITH_UNCERTAINTY";
  return "ACCEPT";
}

/**
 * Proposal-level validation (Sprint12-E3 §4): every newElement,
 * updatedElement, relation, and unresolvedCandidate in a turn's
 * InterpreterOutput is validated and decided INDEPENDENTLY. One bad
 * proposal no longer drags down unrelated good proposals in the same
 * turn — except where a real structural dependency exists (a relation
 * whose endpoint was itself rejected this batch; V10 above).
 */
export function validateInterpretation(
  output: InterpreterOutput,
  graph: ContextGraph,
  recentTurns: ConversationTurn[],
  currentTurn: number,
): InterpretationValidationResult {
  const newElements: ProposalValidation<ProposedElement>[] = output.newElements.map((el) => {
    const issues: ValidationIssue[] = [
      ...validateGrounding(el.groundingTurn, el.groundingText, recentTurns),
      ...validateCurrentTurnGrounding(el.groundingTurn, currentTurn, el.localRef),
      ...validateUnsupportedInference(el.description, el.groundingText, el.confidence >= CONTEXT_CONFIDENCE_POLICY.GROUNDED_MIN ? "explicit" : "inferred"),
      ...validateContradictionIntegrity(el, graph, output.updatedElements),
      ...validateReferenceConfidence(el.groundingText, el.confidence),
      ...validateDuplication(el, graph),
    ];
    return { proposal: el, decision: decisionFromIssues(issues), issues };
  });

  const rejectedNewElementRefs = new Set(
    newElements.filter((n) => n.decision === "REJECT").map((n) => n.proposal.localRef),
  );

  const updatedElements: ProposalValidation<ProposedUpdate>[] = output.updatedElements.map((u) => {
    const issues: ValidationIssue[] = [
      ...validateGrounding(u.groundingTurn, u.groundingText, recentTurns),
      ...validateCurrentTurnGrounding(u.groundingTurn, currentTurn, u.targetElementId),
    ];
    const target = graph.elements.find((e) => e.id === u.targetElementId);
    if (!target) {
      issues.push({ rule: "V1", severity: "reject", target: u.targetElementId, message: "update targets an element id that does not exist in the graph" });
    } else {
      issues.push(...validateIdentityRelation(u));
    }
    return { proposal: u, decision: decisionFromIssues(issues), issues };
  });

  const relations: ProposalValidation<ProposedRelation>[] = output.relations.map((r) => {
    const issues: ValidationIssue[] = [
      ...validateGrounding(r.groundingTurn, r.groundingText, recentTurns),
      ...validateCurrentTurnGrounding(r.groundingTurn, currentTurn, `${r.from}->${r.to}`),
      ...validateRelationIntegrity(r, graph, output.newElements),
      ...validateRelationDependency(r, rejectedNewElementRefs),
    ];
    return { proposal: r, decision: decisionFromIssues(issues), issues };
  });

  const unresolvedCandidates: ProposalValidation<ProposedUnresolved>[] = output.unresolvedCandidates.map((u) => {
    const issues = validateGrounding(u.groundingTurn, u.groundingText, recentTurns);
    return { proposal: u, decision: decisionFromIssues(issues), issues };
  });

  const all = [...newElements, ...updatedElements, ...relations, ...unresolvedCandidates];
  const acceptedCount = all.filter((p) => p.decision === "ACCEPT").length;
  const uncertainCount = all.filter((p) => p.decision === "ACCEPT_WITH_UNCERTAINTY").length;
  const rejectedCount = all.filter((p) => p.decision === "REJECT").length;

  let status: InterpretationStatus;
  if (rejectedCount === 0 && uncertainCount === 0) status = "ACCEPT";
  else if (rejectedCount === 0) status = "ACCEPT_WITH_UNCERTAINTY";
  else if (acceptedCount === 0 && uncertainCount === 0) status = "REJECT";
  else status = "PARTIAL";

  return {
    newElements,
    updatedElements,
    relations,
    unresolvedCandidates,
    summary: { acceptedCount, uncertainCount, rejectedCount, status },
  };
}
