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
   *  safely supply it. Sprint09 — controller.ts passes its current
   *  turnCount into updateUnderstanding(), which stamps it on every
   *  freshly-created Evidence this turn; undefined only when no caller
   *  supplied a turn number (e.g. a test calling updateUnderstanding()
   *  directly without one). */
  turn?: number;
  /** Sprint05 — the literal core-signal words that justified this
   *  evidence (e.g. ["아프"]). Additive metadata only, not a new
   *  EvidenceKind: lets an audit answer "why this value" without
   *  re-running the resolver. Optional — only the topic resolver
   *  populates this today (see understandingEngine.ts's
   *  collectTopicEvidence); other slots may adopt it later. */
  matchedTerms?: string[];
  /** Sprint05 — the literal tie-break/context words that additionally
   *  supported this evidence when core evidence alone was ambiguous
   *  (e.g. ["머리"] for a topic tie-break toward "몸 상태"). Optional,
   *  same scope as matchedTerms. */
  contextTerms?: string[];
};
