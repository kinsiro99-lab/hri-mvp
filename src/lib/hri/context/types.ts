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

export type ContextGraphSummary = {
  elements: Array<Pick<ContextElement, "id" | "kind" | "description" | "active" | "status" | "confidence">>;
  openRelations: Array<Pick<ContextRelation, "id" | "type" | "from" | "to" | "status">>;
};

export function summarizeGraph(graph: ContextGraph): ContextGraphSummary {
  return {
    elements: graph.elements.map(({ id, kind, description, active, status, confidence }) => ({
      id, kind, description, active, status, confidence,
    })),
    openRelations: graph.relations
      .filter((r) => r.status === "open")
      .map(({ id, type, from, to, status }) => ({ id, type, from, to, status })),
  };
}

export type InterpreterInput = {
  /** A small window of the conversation, never the full history — see
   *  Gate report section on Privacy/Data Boundary (Sprint12-C §P). */
  recentTurns: ConversationTurn[];
  activeContext: ContextGraphSummary;
  mode: ConversationMode;
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

export type ProposedUpdate = {
  targetElementId: string;
  kind: Exclude<ContextUpdateKind, "create">;
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
