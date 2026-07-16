import type { Slot } from "./types.v2";

/**
 * 슬롯별 질문 풀 (V2 live path).
 *
 * Planner가 slot을 결정하면 Selector는 이 표에서 문장을 선택한다.
 * - anchored: anchor(사용자 표현)를 사용하는 문형
 * - neutral : anchor가 없을 때 사용하는 문형
 */

export type SlotQuestionPool = {
  anchored: readonly string[];
  neutral: readonly string[];
};

export const SLOT_QUESTIONS: Record<Slot, SlotQuestionPool> = {
  topic: {
    anchored: [
      "지금 그 '{anchor}'은 주로 무엇과 함께 떠오르나요?",
      "지금 그 '{anchor}'은 어디에서 가장 크게 느껴지나요?",
    ],
    neutral: [
      "지금 가장 먼저 떠오르는 것은 무엇인가요?",
      "지금 마음에 가장 오래 머무는 것은 무엇인가요?",
    ],
  },

  target: {
    anchored: [
      "그 '{anchor}'과 가장 가깝게 놓여 있는 것은 무엇인가요?",
      "그 '{anchor}' 가운데 지금 가장 선명한 것은 무엇인가요?",
    ],
    neutral: [
      "지금 가장 먼저 떠오르는 것은 무엇인가요?",
      "그 가운데 가장 선명한 것은 무엇인가요?",
    ],
  },

  emotion: {
    anchored: [
      "그 '{anchor}' 안에서 지금 가장 크게 남아 있는 감정은 무엇인가요?",
      "그 '{anchor}'과 함께 지금도 남아 있는 마음은 무엇인가요?",
    ],
    neutral: [
      "지금 가장 크게 남아 있는 감정은 무엇인가요?",
      "그 안에서 지금도 남아 있는 마음은 무엇인가요?",
    ],
  },

  relationship: {
    anchored: [
      "그 '{anchor}'은 지금 당신과 어떤 관계로 놓여 있나요?",
      "그 '{anchor}'과의 사이는 지금 어떤 자리에 있나요?",
    ],
    neutral: [
      "그 대상은 지금 당신과 어떤 관계로 놓여 있나요?",
      "그 사이는 지금 어떤 자리에 있나요?",
    ],
  },

  presentState: {
    anchored: [
      "그 '{anchor}'은 지금 어떤 상태로 놓여 있나요?",
      "그 '{anchor}'은 지금 당신에게 어떤 모습으로 남아 있나요?",
    ],
    neutral: [
      "그것은 지금 어떤 상태로 놓여 있나요?",
      "그것은 지금 당신에게 어떤 모습으로 남아 있나요?",
    ],
  },

  meaning: {
    anchored: [
      "그 '{anchor}'이 지금의 당신에게 남긴 것은 무엇인가요?",
      "그 '{anchor}'은 당신에게 어떤 의미로 남아 있나요?",
    ],
    neutral: [
      "이 흐름이 지금의 당신에게 남긴 것은 무엇인가요?",
      "그것은 당신에게 어떤 의미로 남아 있나요?",
    ],
  },

  wish: {
    anchored: [
      "그 '{anchor}' 안에서 지금 마음이 가장 바라는 것은 무엇인가요?",
      "그 '{anchor}'과 관련해 지금 가장 바라는 것은 무엇인가요?",
    ],
    neutral: [
      "지금 마음이 가장 바라는 것은 무엇인가요?",
      "지금 가장 바라는 것은 무엇인가요?",
    ],
  },
};

export default SLOT_QUESTIONS;