/**
 * Information Gap — Sprint 04 Knowledge Foundation.
 *
 * Additive layer only. UnderstandingState / UnderstandingCoverage keep
 * their existing plain string|undefined / boolean shape (understandingEngine.ts).
 * Nothing here is consumed by decideNextSlot(), planObservation(), or
 * Reflection readiness yet — that wiring is future Sprint work and is
 * explicitly out of scope this Sprint (see Sprint03/04 reports).
 *
 * SCOPE NOTE: SlotKnowledge / UnderstandingKnowledge represent only the
 * evidence generated during the CURRENT updateUnderstanding() call (this
 * turn's delta), not a persisted cross-turn ledger — SessionStateV2
 * doesn't carry knowledge forward this Sprint. A slot whose value
 * carried over unchanged from an earlier turn (no fresh evidence this
 * call) simply has no entry in `knowledge` on this turn, even though its
 * string value is still present in UnderstandingState. Callers that need
 * a slot's provenance must inspect `knowledge` on the turn it was
 * actually generated.
 */
import type { Evidence } from "./evidence";
import type { Slot } from "./types.v2";

export type SlotKnowledge = {
  value: string;
  evidence: Evidence;
  /** True when the stored value is the user's own text (or a direct
   *  substring extraction of it) rather than an Engine-synthesized
   *  label. */
  isLiteral: boolean;
  sufficient: boolean;
};

export type UnderstandingKnowledge = Partial<Record<Slot, SlotKnowledge>>;

export type SlotGapState =
  | "missing"
  | "placeholder"
  | "inferredWeak"
  | "explicitWeak"
  | "sideEffect"
  | "sufficient";

/**
 * Sufficiency rule (Sprint04, deliberately conservative — the goal is
 * fewer false positives, not more coverage):
 * - no value, or value fails hasEnoughDetail -> insufficient
 * - no evidence at all -> insufficient
 * - placeholder -> always insufficient
 * - sideEffect -> always insufficient this Sprint (no auto-promotion,
 *   even when the underlying value is literal and detailed — see
 *   Sprint04 report section I for the documented cases this affects)
 * - explicit / inferred that passes hasEnoughDetail -> sufficient
 */
export function computeSufficient(
  value: string | undefined,
  evidence: Evidence | undefined,
  hasEnoughDetail: (v?: string) => boolean,
): boolean {
  if (!value) return false;
  if (!hasEnoughDetail(value)) return false;
  if (!evidence) return false;
  if (evidence.kind === "placeholder") return false;
  if (evidence.kind === "sideEffect") return false;
  return true;
}

/**
 * Classifies a single slot's current knowledge into one of six gap
 * states. Judgment only — this Sprint does not act on the result
 * anywhere (decideNextSlot/planObservation/Reflection readiness are
 * unchanged).
 */
export function classifySlotGap(knowledge: SlotKnowledge | undefined): SlotGapState {
  if (!knowledge || !knowledge.value) return "missing";
  if (knowledge.sufficient) return "sufficient";

  switch (knowledge.evidence.kind) {
    case "placeholder":
      return "placeholder";
    case "sideEffect":
      return "sideEffect";
    case "explicit":
      return "explicitWeak";
    case "inferred":
      return "inferredWeak";
    default:
      return "missing";
  }
}
