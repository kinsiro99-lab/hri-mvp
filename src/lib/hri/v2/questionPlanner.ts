import type {
  UnderstandingCoverage,
  UnderstandingState,
} from "./understandingEngine";
import type { Slot, PlannerDecision } from "./types.v2";;

/* =========================================================
 * Planner / Selector Separation (V2 live path)
 *
 * decideNextSlot()은 '슬롯만 결정'하는 단일 진입점이다.
 * 슬롯 순서는 토픽별로 고정되어 있으며, freshAnswer가 있으면
 * anchor 우선순위로 사용된다(withAnchor 참고).
 *
 * Sprint05 note: a gap-aware fallback pass (using buildGapMap/
 * classifySlotGap/questionWorthiness from informationGap.ts) was
 * built and tested here, then explicitly reverted before commit —
 * empirically it changed plannerDecision from null to non-null at the
 * same boundary controller.ts's plannerExhaustedWithDepth reads,
 * indirectly shifting Reflection timing, and it re-surfaced
 * placeholder/sideEffect slots (e.g. target) as real questions in ways
 * that read as regression rather than progress (see Sprint05 Gate
 * report for the exact cases). Question Decision and Stop/Reflection
 * readiness are coupled in a way that can't be safely changed
 * independently — a future Sprint will design them together as one
 * Decision Gate. Until then, this file only ever returns null exactly
 * where the fixed slot order runs out, unchanged since before Sprint05.
 * Persistent Knowledge / Gap Map (informationGap.ts, controller.ts)
 * are still computed every turn — this file just doesn't consume them.
 * ========================================================= */

const SLOT_ORDER_BY_TOPIC: Record<string, readonly Slot[]> = {
  "관계": ["target", "relationship", "emotion", "presentState", "meaning", "wish"],
  "업무 압박": ["target", "presentState", "emotion", "meaning", "wish"],
  "기억": ["target", "emotion", "presentState", "meaning", "wish"],
  "몸 상태": ["target", "presentState", "emotion", "meaning", "wish"],
};
const DEFAULT_SLOT_ORDER: readonly Slot[] = ["target", "presentState", "emotion", "meaning", "wish"];

function slotOrderForTopic(topic: string | undefined): readonly Slot[] {
  if (topic && SLOT_ORDER_BY_TOPIC[topic]) return SLOT_ORDER_BY_TOPIC[topic];
  return DEFAULT_SLOT_ORDER;
}

function withAnchor(
  slot: Slot,
  understanding: UnderstandingState | undefined,
  freshAnswer?: string,
): PlannerDecision {
  // topic is an internal classification label ("관계"/"미래"/"업무 압박"),
  // never something the user actually said — using it as an anchor
  // quotes the system's own category back at the user.
  //
  // freshAnswer is the literal text the user just gave for whatever slot
  // was probed last turn (undefined if nothing was probed, or the answer
  // was too weak to count). It reflects the newest concrete information
  // the user provided, so it takes priority over `understanding.emotion`,
  // which — once set — otherwise stays frozen at whatever it was on the
  // turn it was first detected and would keep being quoted as anchor long
  // after the conversation has moved on to more specific information.
  // isUsableAnchor (selector.ts) still filters out anything ungrammatical
  // before it reaches a question, falling back to neutral phrasing.
  const anchor = freshAnswer || understanding?.emotion;
  return anchor ? { slot, anchor } : { slot };
}

function decideNextSlot(
  understanding: UnderstandingState | undefined,
  coverage: UnderstandingCoverage | undefined,
  freshAnswer?: string,
): PlannerDecision | null {
  if (!coverage) return null;

  if (!coverage.topic) {
    return withAnchor("topic", understanding, freshAnswer);
  }

  const slotsInOrder = slotOrderForTopic(understanding?.topic);

  // Fixed-order walk, unchanged from before Sprint05: returns
  // immediately, unconditionally, the moment it finds any genuinely
  // uncovered (coverage=false) slot; returns null once every slot in
  // this topic's sequence is boolean-covered. No gap-aware override —
  // see the file-level note above for why that was tried and reverted.
  for (const slot of slotsInOrder) {
    if (!coverage[slot]) return withAnchor(slot, understanding, freshAnswer);
  }

  return null;
}

export function planQuestionDecision(
  understanding: UnderstandingState | undefined,
  coverage: UnderstandingCoverage | undefined,
  freshAnswer?: string,
): PlannerDecision | null {
  return decideNextSlot(understanding, coverage, freshAnswer);
}