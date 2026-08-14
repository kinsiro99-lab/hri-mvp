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
 * ========================================================= */

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

  switch (understanding?.topic) {
    case "관계":
      if (!coverage.target) return withAnchor("target", understanding, freshAnswer);
      if (!coverage.relationship) return withAnchor("relationship", understanding, freshAnswer);
      if (!coverage.emotion) return withAnchor("emotion", understanding, freshAnswer);
      if (!coverage.presentState) return withAnchor("presentState", understanding, freshAnswer);
      if (!coverage.meaning) return withAnchor("meaning", understanding, freshAnswer);
      if (!coverage.wish) return withAnchor("wish", understanding, freshAnswer);
      return null;

    case "업무 압박":
      if (!coverage.target) return withAnchor("target", understanding, freshAnswer);
      if (!coverage.presentState) return withAnchor("presentState", understanding, freshAnswer);
      if (!coverage.emotion) return withAnchor("emotion", understanding, freshAnswer);
      if (!coverage.meaning) return withAnchor("meaning", understanding, freshAnswer);
      if (!coverage.wish) return withAnchor("wish", understanding, freshAnswer);
      return null;

    case "기억":
      if (!coverage.target) return withAnchor("target", understanding, freshAnswer);
      if (!coverage.emotion) return withAnchor("emotion", understanding, freshAnswer);
      if (!coverage.presentState) return withAnchor("presentState", understanding, freshAnswer);
      if (!coverage.meaning) return withAnchor("meaning", understanding, freshAnswer);
      if (!coverage.wish) return withAnchor("wish", understanding, freshAnswer);
      return null;

    case "몸 상태":
      if (!coverage.target) return withAnchor("target", understanding, freshAnswer);
      if (!coverage.presentState) return withAnchor("presentState", understanding, freshAnswer);
      if (!coverage.emotion) return withAnchor("emotion", understanding, freshAnswer);
      if (!coverage.meaning) return withAnchor("meaning", understanding, freshAnswer);
      if (!coverage.wish) return withAnchor("wish", understanding, freshAnswer);
      return null;

    default:
      if (!coverage.target) return withAnchor("target", understanding, freshAnswer);
      if (!coverage.presentState) return withAnchor("presentState", understanding, freshAnswer);
      if (!coverage.emotion) return withAnchor("emotion", understanding, freshAnswer);
      if (!coverage.meaning) return withAnchor("meaning", understanding, freshAnswer);
      if (!coverage.wish) return withAnchor("wish", understanding, freshAnswer);
      return null;
  }
}

export function planQuestionDecision(
  understanding: UnderstandingState | undefined,
  coverage: UnderstandingCoverage | undefined,
  freshAnswer?: string,
): PlannerDecision | null {
  return decideNextSlot(understanding, coverage, freshAnswer);
}