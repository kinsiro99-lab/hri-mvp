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
 * states. Judgment only — this function has no side effects and does
 * not by itself decide whether to ask anything (see questionWorthiness
 * below for that, and questionPlanner.ts for where it's actually used).
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

export const ALL_SLOTS: readonly Slot[] = [
  "topic", "target", "emotion", "relationship", "presentState", "meaning", "wish",
];

/**
 * Sprint05 — turn-local -> persistent Knowledge.
 *
 * `freshKnowledge` is this turn's delta (Sprint04 behavior, unchanged).
 * `prevKnowledge` is what was carried over from the previous turn.
 * `next` is this turn's final UnderstandingState — the single source
 * of truth for "what is the slot's value right now".
 *
 * Rule: fresh evidence always wins when present (it reflects the value
 * that's actually in `next` this turn, by construction — see
 * understandingEngine.ts's buildUnderstandingKnowledge). Otherwise the
 * previous turn's knowledge is kept ONLY if its value still matches
 * `next[slot]` (stale-provenance guard — see module doc). A slot with
 * a value but no valid evidence either way (fresh or matching-persisted)
 * is simply omitted, not fabricated.
 *
 * This does not implement a generic "explicit > inferred > sideEffect >
 * placeholder" override: fresh evidence is never compared against
 * persisted evidence by kind ranking. A slot's value only changes when
 * updateUnderstanding() actually produces a new one (i.e. when it was
 * genuinely re-probed or freshly inferred this turn), and whenever that
 * happens the fresh evidence IS the correct explanation for the new
 * value — there is nothing to rank it against. The kind-priority note
 * in the Sprint05 brief describes what must NOT happen (silently
 * upgrading old placeholder evidence to explicit just because a new,
 * unrelated answer arrived) — this function achieves that by never
 * touching a slot's evidence unless that slot's value itself changed.
 */
export function mergeUnderstandingKnowledge(
  prevKnowledge: UnderstandingKnowledge | undefined,
  freshKnowledge: UnderstandingKnowledge,
  next: Partial<Record<Slot, string | undefined>>,
): UnderstandingKnowledge {
  const merged: UnderstandingKnowledge = {};

  for (const slot of ALL_SLOTS) {
    const value = next[slot];
    if (!value) continue;

    const fresh = freshKnowledge[slot];
    if (fresh) {
      merged[slot] = fresh;
      continue;
    }

    const persisted = prevKnowledge?.[slot];
    if (persisted && persisted.value === value) {
      merged[slot] = persisted;
    }
    // else: no fresh evidence this turn and no valid (non-stale)
    // persisted evidence — omitted. classifySlotGap(undefined) reports
    // this as "missing", matching the module's conservative stance:
    // never claim provenance we can't currently verify.
  }

  return merged;
}

/**
 * Sprint05 — one gap state per slot, computed from the current
 * (persistent) Knowledge. Entirely separate from UnderstandingCoverage
 * — coverage keeps its existing boolean meaning untouched, this is an
 * additional, more detailed view for the same 7 slots.
 */
export function buildGapMap(
  knowledge: UnderstandingKnowledge,
): Record<Slot, SlotGapState> {
  const map = {} as Record<Slot, SlotGapState>;
  for (const slot of ALL_SLOTS) {
    map[slot] = classifySlotGap(knowledge[slot]);
  }
  return map;
}

/**
 * Sprint05 — how eligible a gap state is to become a question, per the
 * Sprint05 brief's table. This is a judgment only; nothing in
 * questionPlanner.ts consumes it yet (a gap-aware fallback pass in
 * decideNextSlot was built and tested, then reverted before commit —
 * see questionPlanner.ts's file-level note for why).
 */
export type QuestionWorthiness = "primary" | "secondary" | "clarify" | "excluded";

export function questionWorthiness(gap: SlotGapState): QuestionWorthiness {
  switch (gap) {
    case "missing":
      return "primary";
    case "inferredWeak":
      return "primary";
    case "placeholder":
      return "secondary";
    case "sideEffect":
      return "secondary";
    case "explicitWeak":
      return "clarify";
    case "sufficient":
      return "excluded";
  }
}
