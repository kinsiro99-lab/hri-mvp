/**
 * Evidence — minimal provenance representation for the Understanding
 * Layer's candidate-resolution functions (updateTopic / updateEmotion).
 *
 * This is an internal working representation only. UnderstandingState
 * and UnderstandingCoverage (understandingEngine.ts) keep their existing
 * plain string|undefined / boolean external shape — callers (controller.ts,
 * Observation OS, Reflection, UI) never see an Evidence object directly.
 *
 * Deliberately not a scoring/ML structure: no numeric confidence field.
 * `kind` is a closed, small enum; resolution is decided by counting real
 * keyword matches (see collectTopicEvidence/collectEmotionEvidence in
 * understandingEngine.ts), not by a learned or fuzzy weight.
 */
export type EvidenceKind =
  /** The user's literal answer to the question that was actually asked
   *  for this slot (i.e. probedFor() in understandingEngine.ts). */
  | "explicit"
  /** A value chosen because a SEMANTIC_GROUPS keyword matched the raw
   *  input text — the common case for topic/emotion resolution. */
  | "inferred"
  /** A generic fallback value substituted when no real answer/keyword
   *  is available (e.g. target defaulting to a topic-shaped label). */
  | "placeholder"
  /** A value filled in as a byproduct of resolving a *different* slot's
   *  evidence (e.g. a wish-shaped phrase surfacing while answering an
   *  emotion question). */
  | "sideEffect";

export type Evidence = {
  /** The resolved value this evidence supports (e.g. a topic name or emotion label). */
  value: string;
  kind: EvidenceKind;
  /** The text this evidence was drawn from. */
  sourceText: string;
  /** SEMANTIC_GROUPS path (e.g. "memory.regret") or a short synthetic
   *  label for evidence outside SEMANTIC_GROUPS (e.g. "direct.joy").
   *  Optional — omitted when there is no single matched group to name. */
  matchedGroup?: string;
  /** Turn number this evidence was produced on, when the caller can
   *  safely supply it. Optional — understandingEngine.ts's current
   *  functions don't thread turn count through, so this stays unset
   *  there; left available for callers that do have it. */
  turn?: number;
};
