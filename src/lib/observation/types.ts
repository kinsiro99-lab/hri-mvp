/**
 * Observation Console logging schema — NOT the Observation OS engine
 * (see src/lib/hri/v2/observation*.ts for that). This describes the
 * shape of a persisted session-level observation record, independent
 * of whatever storage backend eventually writes it.
 *
 * Implementation-independent by design: only plain, serializable
 * fields (string/number/boolean). No database-, file-, or
 * vendor-specific types (no ObjectId, Timestamp, JSONB wrapper,
 * etc.), so this schema stays stable across JSON → Neon → Supabase →
 * S3 → Analytics backends.
 */

export type ObservationEvent = {
  timestamp: string;
  sessionId: string;
  firstInput: string;
  turnCount: number;
  reflectionCompleted: boolean;
  feedback: string | null;
};

/**
 * Question Observation Foundation Sprint 01 — one row per (question
 * shown, answer given) pair, additive alongside ObservationEvent
 * above (unchanged). questionRef is a stable question/source
 * identifier IF one genuinely exists upstream — none does yet in the
 * live intelligence-core path (see the Beta Quality Completion audit),
 * so this is null for now rather than a fabricated id. Structurally
 * distinct from ObservationEvent.firstInput (user-authored) — this
 * type's questionText is always HRI-authored, answerText is always
 * user-authored, never conflated.
 */
export type ObservationTurn = {
  timestamp: string;
  sessionId: string;
  turnIndex: number;
  questionText: string;
  questionRef: string | null;
  answerText: string;
};

/**
 * Question Observation Foundation Sprint 01 — the final Reflection
 * text for a session, kept in its own record (not bolted onto
 * ObservationEvent) so the existing session-level row's shape/trigger
 * never has to change. HRI-authored, like ObservationTurn.questionText
 * — never conflated with user input.
 */
export type ObservationReflection = {
  timestamp: string;
  sessionId: string;
  reflectionText: string;
};

/**
 * Reality Gain Observation Sprint 02 — one row per turn, classifying
 * what structurally changed in the live ContextGraph as a direct
 * result of that turn's answer. gainType is derived purely from
 * counts already computed by intelligenceCore.ts's updateGraph()
 * (see StructuralChangeSummary there) — never from answer length,
 * emotion words, an LLM judge call, or the Reflection text. Priority
 * when a turn produced more than one kind of change:
 * NEW_REALITY > RELATION > CLARIFICATION > NO_STRUCTURAL_GAIN.
 * elementRef is a real ContextElement/ContextRelation id when one is
 * available, never a fabricated identifier — null otherwise.
 */
export type RealityGainType = "NEW_REALITY" | "CLARIFICATION" | "RELATION" | "NO_STRUCTURAL_GAIN";

export type ObservationRealityGain = {
  timestamp: string;
  sessionId: string;
  turnIndex: number;
  gainType: RealityGainType;
  newElementCount: number;
  updatedElementCount: number;
  newRelationCount: number;
  elementRef: string | null;
};

/**
 * Question Quality Evaluation V1 (Sprint 03) — deterministic
 * evaluation derived ONLY from an already-recorded ObservationRealityGain
 * row, never from wording/length/an LLM judge (see classifyGain/
 * evaluateQuestionQuality in adapter.ts). Kept in its own table, never
 * overwriting observation_reality_gains — this record is a JUDGMENT
 * about those facts, not a replacement for them (join on
 * sessionId+turnIndex to see both).
 *
 * NEW_REALITY is deliberately NOT treated as automatically superior
 * to CLARIFICATION/RELATION anywhere in this V1 — realityGain simply
 * carries the same RealityGainType value through as a record of WHAT
 * happened, with no ranking/scoring applied to it.
 */
export type QuestionQualityRedundancy = "NOT_REDUNDANT" | "UNKNOWN";
// V1 has no reliable turn-level grounding-safety signal reaching
// Observation yet (see the Sprint's own signal audit) — this is
// always NOT_OBSERVABLE for now, not a fabricated verdict. Typed as a
// union of one, rather than a plain boolean/string literal, so a
// future sprint adding a real signal is a natural type extension here.
export type QuestionQualityGroundingSafety = "NOT_OBSERVABLE";
export type QuestionQualityInformationGain = "ADDED" | "REFINED" | "NONE";

export const QUESTION_QUALITY_EVALUATION_VERSION = "v1";

export type ObservationQuestionQuality = {
  timestamp: string;
  sessionId: string;
  turnIndex: number;
  evaluationVersion: string;
  /** Same value as the source ObservationRealityGain.gainType for this
   *  turn — carried through as-is, not re-derived or re-judged. */
  realityGain: RealityGainType;
  redundancy: QuestionQualityRedundancy;
  groundingSafety: QuestionQualityGroundingSafety;
  informationGain: QuestionQualityInformationGain;
  /** Name of the table/fact source this evaluation was derived from —
   *  always "observation_reality_gains" in V1. */
  provenance: string;
};
