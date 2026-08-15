/**
 * Context Confidence Policy — Sprint12-D §12.
 *
 * PROVISIONAL. These numbers are placeholders carried over from
 * Sprint12-C's design discussion, not measured against any real
 * Semantic Provider output. Every threshold used anywhere in
 * src/lib/hri/context/ MUST come from this file — no magic numbers
 * scattered through validator.ts / ruleBasedAdapter.ts /
 * evaluationHarness.ts. Sprint12-E should revisit every value here
 * once a real provider's confidence output can be measured, and this
 * file is the single place that would need to change.
 */
export const CONTEXT_CONFIDENCE_POLICY = {
  /** confidence >= this: usable as a primary grounded fact (Sprint12-C
   *  §G tier "A. Grounded Fact"). PROVISIONAL. */
  GROUNDED_MIN: 0.75,

  /** GROUNDED_MIN > confidence >= this: stored in the graph, but never
   *  the sole basis for a relation or a primary UnresolvedPoint
   *  (Sprint12-C §G tier "B. Supported Inference"). Below this:
   *  tier "C. Uncertain/Unresolved" — not promoted to a
   *  ContextElement at all. PROVISIONAL. */
  UNCERTAIN_MIN: 0.40,

  /** Validator V7 merge-safety heuristic only (never a semantic
   *  duplicate-truth judgment): overlap >= this between a new
   *  candidate and an existing active element of the same kind is
   *  treated as likely-the-same-thing (reinforce candidate).
   *  PROVISIONAL. */
  DUPLICATE_MERGE_MIN: 0.60,

  /** Overlap in [DUPLICATE_UNCERTAIN_MIN, DUPLICATE_MERGE_MIN) is
   *  "maybe the same thing" — kept as two elements plus a low-
   *  confidence `relatesTo` relation, never force-merged. Below this:
   *  treated as unrelated. PROVISIONAL. */
  DUPLICATE_UNCERTAIN_MIN: 0.30,
} as const;
