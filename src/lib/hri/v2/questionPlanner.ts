import type {
  UnderstandingCoverage,
  UnderstandingState,
} from "./understandingEngine";
import type { Slot, PlannerDecision } from "./types.v2";;

export function planQuestion(
  understanding: UnderstandingState | undefined,
  coverage: UnderstandingCoverage | undefined,
): string | null {
  if (!coverage) return null;

  if (!coverage.topic) {
    return "지금 가장 먼저 떠오르는 대상은 무엇인가요?";
  }

  switch (understanding?.topic) {
    case "관계":
      return planRelationship(coverage);

    case "업무 압박":
      return planWork(coverage);

    case "기억":
      return planMemory(coverage);

    case "몸 상태":
      return planHealth(coverage);

    default:
      return planDefault(coverage);
  }
}

function planRelationship(c: UnderstandingCoverage): string | null {
  if (!c.target) return "그 장면이나 사람 가운데 가장 선명한 것은 무엇인가요?";
  if (!c.relationship) return "그 대상은 지금 당신과 어떤 관계로 남아 있나요?";
  if (!c.emotion) return "그때의 감정 가운데 지금도 가장 남아 있는 것은 무엇인가요?";
  if (!c.presentState) return "그 기억은 지금의 당신에게 어떤 모습으로 남아 있나요?";
  if (!c.meaning) return "이 관계가 당신에게 남긴 것은 무엇인가요?";
  if (!c.wish) return "지금 마음이 가장 바라는 것은 무엇인가요?";

  return null;
}

function planWork(c: UnderstandingCoverage): string | null {
  if (!c.target) return "지금 가장 크게 마음을 차지하는 일은 무엇인가요?";
  if (!c.presentState) return "그 일은 지금 어떤 상태로 놓여 있나요?";
  if (!c.emotion) return "그 상황에서 가장 크게 남아 있는 감정은 무엇인가요?";
  if (!c.meaning) return "이 상황이 당신에게 가장 크게 남긴 것은 무엇인가요?";
  if (!c.wish) return "지금 가장 바라는 변화는 무엇인가요?";

  return null;
}

function planMemory(c: UnderstandingCoverage): string | null {
  if (!c.target) return "그 장면 가운데 가장 선명한 것은 무엇인가요?";
  if (!c.emotion) return "그 기억과 함께 가장 오래 남아 있는 감정은 무엇인가요?";
  if (!c.presentState) return "그 기억은 지금 어떤 모습으로 남아 있나요?";
  if (!c.meaning) return "그 기억이 당신에게 남긴 것은 무엇인가요?";
  if (!c.wish) return "지금 마음이 가장 바라는 것은 무엇인가요?";

  return null;
}

function planHealth(c: UnderstandingCoverage): string | null {
  if (!c.target) return "가장 크게 느껴지는 부분은 무엇인가요?";
  if (!c.presentState) return "지금은 어떤 상태인가요?";
  if (!c.emotion) return "그 상태가 가장 힘들게 만드는 감정은 무엇인가요?";
  if (!c.meaning) return "그 경험이 당신에게 남긴 것은 무엇인가요?";
  if (!c.wish) return "지금 가장 필요한 것은 무엇인가요?";

  return null;
}

function planDefault(c: UnderstandingCoverage): string | null {
  if (!c.target) return "지금 가장 먼저 떠오르는 것은 무엇인가요?";
  if (!c.presentState) return "그 일은 지금 어떤 상태로 놓여 있나요?";
  if (!c.emotion) return "그 상황에서 가장 크게 남아 있는 감정은 무엇인가요?";
  if (!c.meaning) return "이 흐름이 당신에게 남긴 것은 무엇인가요?";
  if (!c.wish) return "지금 마음이 가장 바라는 것은 무엇인가요?";

  return null;
}
/* =========================================================
 * Planner / Selector Separation (V2 live path) — 추가분
 *
 * 기존 planQuestion()과 하위 plan* 함수들은 수정하지 않는다.
 * 여기서는 '슬롯만 결정'하는 새 진입점을 추가한다.
 * decideNextSlot()의 슬롯 순서는 기존 plan* 함수와 1:1로 동일하다.
 * 문장 변환(slotToQuestionText)은 Patch 4 이후 controller 전환 시 다룬다.
 * ========================================================= */

function withAnchor(
  slot: Slot,
  understanding: UnderstandingState | undefined,
): PlannerDecision {
  const anchor = understanding?.emotion ?? understanding?.topic;
  return anchor ? { slot, anchor } : { slot };
}

function decideNextSlot(
  understanding: UnderstandingState | undefined,
  coverage: UnderstandingCoverage | undefined,
): PlannerDecision | null {
  if (!coverage) return null;

  if (!coverage.topic) {
    return withAnchor("topic", understanding);
  }

  switch (understanding?.topic) {
    case "관계":
      if (!coverage.target) return withAnchor("target", understanding);
      if (!coverage.relationship) return withAnchor("relationship", understanding);
      if (!coverage.emotion) return withAnchor("emotion", understanding);
      if (!coverage.presentState) return withAnchor("presentState", understanding);
      if (!coverage.meaning) return withAnchor("meaning", understanding);
      if (!coverage.wish) return withAnchor("wish", understanding);
      return null;

    case "업무 압박":
      if (!coverage.target) return withAnchor("target", understanding);
      if (!coverage.presentState) return withAnchor("presentState", understanding);
      if (!coverage.emotion) return withAnchor("emotion", understanding);
      if (!coverage.meaning) return withAnchor("meaning", understanding);
      if (!coverage.wish) return withAnchor("wish", understanding);
      return null;

    case "기억":
      if (!coverage.target) return withAnchor("target", understanding);
      if (!coverage.emotion) return withAnchor("emotion", understanding);
      if (!coverage.presentState) return withAnchor("presentState", understanding);
      if (!coverage.meaning) return withAnchor("meaning", understanding);
      if (!coverage.wish) return withAnchor("wish", understanding);
      return null;

    case "몸 상태":
      if (!coverage.target) return withAnchor("target", understanding);
      if (!coverage.presentState) return withAnchor("presentState", understanding);
      if (!coverage.emotion) return withAnchor("emotion", understanding);
      if (!coverage.meaning) return withAnchor("meaning", understanding);
      if (!coverage.wish) return withAnchor("wish", understanding);
      return null;

    default:
      if (!coverage.target) return withAnchor("target", understanding);
      if (!coverage.presentState) return withAnchor("presentState", understanding);
      if (!coverage.emotion) return withAnchor("emotion", understanding);
      if (!coverage.meaning) return withAnchor("meaning", understanding);
      if (!coverage.wish) return withAnchor("wish", understanding);
      return null;
  }
}

export function planQuestionDecision(
  understanding: UnderstandingState | undefined,
  coverage: UnderstandingCoverage | undefined,
): PlannerDecision | null {
  return decideNextSlot(understanding, coverage);
}