/**
 * Semantic Context Interpreter — Core Contract (Sprint12-D).
 *
 * Standalone, dependency-free from the live Runtime. Nothing in this
 * directory (src/lib/hri/context/) is imported by controller.ts /
 * questionPlanner.ts / decisionGate.ts / reflectionComposer.ts /
 * understandingEngine.ts, and this file imports nothing from any of
 * them either — see Sprint12-D Gate report section A for the
 * import-boundary check. This is the test bed for whatever Semantic
 * Provider Sprint12-E evaluates; it is not itself a working
 * interpreter.
 *
 * Sprint12-D §6 boundary: InterpreterOutput deliberately has no field
 * for question / suggestedQuestion / advice / reflection / response /
 * nextAction / shouldAsk / shouldReflect. This is enforced by
 * omission — the type has no room for them, so a conforming
 * implementation cannot add "what to say to the user" without
 * failing schema validation upstream. See Gate A.
 */

export type ConversationMode = "individual" | "organization";

export type ElementKind = "situation" | "direction" | "constraint" | "response";

export type ElementStatus = "active" | "revised" | "deprioritized" | "conflicted" | "resolved";

/**
 * Additive wrapper only — does not replace or duplicate the existing
 * Evidence/SlotKnowledge provenance system (evidence.ts,
 * informationGap.ts). `kind` reuses the same two values that matter
 * here ("explicit" | "inferred") rather than the full EvidenceKind
 * enum, since Context-level grounding only needs to distinguish
 * "literally in the text" from "inferred from it" — sideEffect/
 * placeholder are Understanding-layer provenance concepts that don't
 * have a Context-layer equivalent yet (see Gate report section E).
 */
export type EvidenceRef = {
  evidenceId?: string;
  turn: number;
  sourceText: string;
  kind: "explicit" | "inferred";
};

export type ContextElement = {
  id: string;
  kind: ElementKind;
  description: string;
  active: boolean;
  status: ElementStatus;
  evidenceRefs: EvidenceRef[];
  confidence: number;
};

export type RelationType =
  | "limits"
  | "supports"
  | "conflictsWith"
  | "respondsTo"
  | "clarifies"
  | "revises"
  | "relatesTo";

export type RelationStatus = "open" | "acknowledged" | "resolved";

export type ContextRelation = {
  id: string;
  type: RelationType;
  from: string;
  to: string;
  evidenceRefs: EvidenceRef[];
  /** Always "inferred": the relation between two elements is never
   *  itself something the user stated in one literal sentence, even
   *  when both endpoints are individually explicit. */
  provenance: "inferred";
  confidence: number;
  status: RelationStatus;
};

export type ContextUpdateKind =
  | "create"
  | "reinforce"
  | "specify"
  | "revise"
  | "conflict"
  | "deprioritize"
  | "resolve";

export type ContextUpdateLogEntry = {
  turn: number;
  elementId: string;
  kind: ContextUpdateKind;
  note: string;
};

export type UnresolvedPoint = {
  id: string;
  relatesTo: string[];
  /** Descriptive sentence — never a question string. */
  reason: string;
  grounding: EvidenceRef[];
  uncertainty: number;
  potentialInformationGain: "low" | "medium" | "high";
};

export type ContextGraph = {
  elements: ContextElement[];
  relations: ContextRelation[];
  unresolved: UnresolvedPoint[];
  updateLog: ContextUpdateLogEntry[];
};

export function emptyContextGraph(): ContextGraph {
  return { elements: [], relations: [], unresolved: [], updateLog: [] };
}

/* =========================================================
 * Interpreter Input / Output Contract
 * ========================================================= */

export type ConversationTurn = { turn: number; text: string };

/**
 * Sprint12-E8 §7: `unresolved` added — Sprint12-E4 through E7 never
 * exposed the graph's unresolved points back to the Interpreter at
 * all, which meant a NOT_DECIDABLE/unresolved item created at turn N
 * was invisible to the very process that would need to see it to
 * recognize the same open question resurfacing at turn N+1 (Sprint12-E7
 * report §M — the confirmed "Information Preservation" break). Fields
 * here are a minimal passthrough of what UnresolvedPoint already
 * stores — the single most recent grounding quote/turn, not the full
 * evidence history, and never a freshly-generated paraphrase (§7 "새로운
 * 자유 텍스트 해석을 생성해서 summary를 만들지 않는다").
 */
export type ContextGraphSummary = {
  elements: Array<Pick<ContextElement, "id" | "kind" | "description" | "active" | "status" | "confidence">>;
  openRelations: Array<Pick<ContextRelation, "id" | "type" | "from" | "to" | "status">>;
  unresolved: Array<Pick<UnresolvedPoint, "id" | "relatesTo" | "reason" | "uncertainty" | "potentialInformationGain"> & { latestGroundingTurn: number; latestGroundingText: string }>;
};

export function summarizeGraph(graph: ContextGraph): ContextGraphSummary {
  return {
    elements: graph.elements.map(({ id, kind, description, active, status, confidence }) => ({
      id, kind, description, active, status, confidence,
    })),
    openRelations: graph.relations
      .filter((r) => r.status === "open")
      .map(({ id, type, from, to, status }) => ({ id, type, from, to, status })),
    unresolved: graph.unresolved.map(({ id, relatesTo, reason, uncertainty, potentialInformationGain, grounding }) => {
      const latest = grounding[grounding.length - 1];
      return { id, relatesTo, reason, uncertainty, potentialInformationGain, latestGroundingTurn: latest?.turn ?? 0, latestGroundingText: latest?.sourceText ?? "" };
    }),
  };
}

/**
 * Minimal cross-turn feedback (Sprint12-E2 §15) so a stateless Provider
 * does not mistake its own rejected proposal for approved graph truth on
 * the next call — Sprint12-E's CASE Topic Shift finding was a Provider
 * re-targeting a localRef from a proposal that had been REJECTED the
 * previous turn, because it had no way to know that. This is NOT a
 * history log: only the immediately preceding turn's outcome is
 * carried, and none of it is ever persisted into ContextGraph.
 */
export type PreviousProposalFeedback = {
  acceptedRefs: string[];
  rejectedRefs: string[];
  uncertainRefs: string[];
  reasons: string[];
};

export type InterpreterInput = {
  /** A small window of the conversation, never the full history — see
   *  Gate report section on Privacy/Data Boundary (Sprint12-C §P). */
  recentTurns: ConversationTurn[];
  activeContext: ContextGraphSummary;
  mode: ConversationMode;
  /** Absent on the first turn of a session. */
  previousProposal?: PreviousProposalFeedback;
};

/**
 * `localRef` is an ephemeral handle scoped to a single
 * InterpreterOutput batch — it is never persisted as a real
 * ContextElement.id. ProposedRelation.from/to may reference either an
 * existing ContextElement.id already in the graph, or a `localRef`
 * from this same output's newElements[] (a relation to a fact the
 * interpreter is proposing in the same turn).
 */
export type ProposedElement = {
  localRef: string;
  kind: ElementKind;
  description: string;
  groundingTurn: number;
  groundingText: string;
  confidence: number;
};

/**
 * Explicit self-reported identity judgment (Sprint12-E2 §13): does this
 * turn continue, clarify, or revise the target element, or is the
 * interpreter unsure it is even the same referent? Originally (E2) this
 * was cross-checked by Validator V9 via lexical overlap with the
 * target's description — that check was removed in Sprint12-E3 §10
 * (it was itself a disguised semantic judgment, and empirically wrong
 * in both directions: false-rejects on a genuine continuation written
 * in a different language, false-accepts on a false merge padded with
 * boilerplate copied from the target). Since Sprint12-E4, an
 * independent SemanticIdentityReviewer (identityReview.ts) judges this
 * claim instead, structurally outside the Validator entirely — see
 * that file and the Sprint12-E4/E5 reports for the current mechanism.
 */
export type IdentityRelation = "continuation" | "clarification" | "revision" | "uncertainSameElement";

export type ProposedUpdate = {
  targetElementId: string;
  kind: Exclude<ContextUpdateKind, "create">;
  identityRelation: IdentityRelation;
  /**
   * Sprint12-E5 §6/§9: "if this turns out NOT to be the same element as
   * targetElementId after all, what ElementKind would this content be
   * as its own, independent element?" Always required, even when the
   * Interpreter is confident this IS the same element — this is what
   * lets Sprint12-E5's identity review PROMOTE a reclassified update
   * straight into a real newElement (identityReview.ts) using only
   * content the Interpreter already generated, never inventing a kind
   * after the fact (§18 "Promotion은 정보 발명이 아니다").
   */
  impliedElementKind: ElementKind;
  note: string;
  groundingTurn: number;
  groundingText: string;
  confidence: number;
};

export type ProposedRelation = {
  type: RelationType;
  from: string;
  to: string;
  groundingTurn: number;
  groundingText: string;
  confidence: number;
};

export type ProposedUnresolved = {
  /**
   * Sprint12-E8 §5/§7: if this evidence is about the SAME open question
   * as an existing unresolved point (visible in activeContext.unresolved
   * — see ContextGraphSummary below), echo its id here so the harness
   * updates that point in place instead of creating a duplicate.
   * Omitted (or an id not yet present in the graph) means "new" — see
   * evaluationHarness.ts's mergeInterpreterOutput for exactly how this
   * is resolved. Mirrors the existing `targetElementId` pattern for
   * ProposedUpdate — same mechanism, not a new concept.
   */
  existingUnresolvedId?: string;
  relatesTo: string[];
  reason: string;
  groundingTurn: number;
  groundingText: string;
  uncertainty: number;
  potentialInformationGain: "low" | "medium" | "high";
};

export type InterpreterOutput = {
  newElements: ProposedElement[];
  updatedElements: ProposedUpdate[];
  relations: ProposedRelation[];
  unresolvedCandidates: ProposedUnresolved[];
  /** Batch-level confidence — a coarse summary, not a substitute for
   *  each proposal's own `confidence`. */
  confidence: number;
  /** Human-audit trail only. Never read by any conditional logic —
   *  see Gate report section A. */
  uncertaintyNotes: string[];
};

export interface SemanticContextInterpreter {
  interpret(input: InterpreterInput): Promise<InterpreterOutput>;
}
