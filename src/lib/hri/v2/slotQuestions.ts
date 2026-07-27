import type { Slot } from "./types.v2";

/**
 * 슬롯별 질문 풀.
 *
 * 원칙:
 * - topic: 이야기의 중심 확인
 * - target: 구체적인 대상·장면 확인
 * - emotion: 감정 확인
 * - relationship: 관계의 상태 확인
 * - presentState: 현재 영향과 상태 확인
 * - meaning: 개인적 의미 확인
 * - wish: 마음이 향하는 방향 확인
 *
 * 서로 다른 슬롯이 같은 질문처럼 들리지 않도록 역할을 분리한다.
 */

export type SlotQuestionPool = {
  anchored: readonly string[];
  neutral: readonly string[];
};

export const SLOT_QUESTIONS: Record<Slot, SlotQuestionPool> = {
  topic: {
    anchored: [
      "지금 그 '{anchor}'을 떠올리게 된 계기는 무엇인가요?",
      "그 '{anchor}'에서 지금 이야기하고 싶은 중심은 무엇인가요?",
    ],
    neutral: [
      "지금 가장 이야기하고 싶은 일은 무엇인가요?",
      "오늘 마음을 붙잡고 있는 주제는 무엇인가요?",
    ],
  },

  target: {
    anchored: [
      "그 '{anchor}'을 떠올릴 때 가장 먼저 보이는 장면은 무엇인가요?",
      "그 '{anchor}'과 연결된 사람이나 장소 중 무엇이 가장 먼저 떠오르나요?",
    ],
    neutral: [
      "그 일에서 가장 먼저 떠오르는 사람이나 장면은 무엇인가요?",
      "그 기억을 한 장면으로 떠올리면 어떤 모습인가요?",
    ],
  },

  emotion: {
    anchored: [
      "그 '{anchor}'을 떠올릴 때 지금 느껴지는 감정은 무엇인가요?",
      "그 '{anchor}'과 함께 올라오는 마음을 한 단어로 표현하면 무엇인가요?",
    ],
    neutral: [
      "그 장면을 바라볼 때 지금 느껴지는 감정은 무엇인가요?",
      "지금의 마음을 가장 가까운 말로 표현하면 무엇인가요?",
    ],
  },

  relationship: {
    anchored: [
      "그 '{anchor}'은 지금 당신과 어떤 관계로 남아 있나요?",
      "그 '{anchor}'과의 연결은 지금 어떤 상태인가요?",
    ],
    neutral: [
      "그 사람과의 관계는 지금 어떤 상태인가요?",
      "그 연결은 현재 이어져 있나요, 멀어져 있나요?",
    ],
  },

  presentState: {
    anchored: [
      "그 '{anchor}'은 지금의 일상에 어떤 영향을 주고 있나요?",
      "그 '{anchor}'을 떠올린 뒤 지금 마음은 어떤 상태인가요?",
    ],
    neutral: [
      "그 일이 지금의 당신에게 어떤 영향을 주고 있나요?",
      "그 이야기를 떠올린 지금, 마음의 상태는 어떤가요?",
    ],
  },

  meaning: {
    anchored: [
      "그 '{anchor}'이 당신에게 중요하게 느껴지는 이유는 무엇인가요?",
      "그 '{anchor}'은 당신에게 어떤 의미를 가지고 있나요?",
    ],
    neutral: [
      "그 경험이 당신에게 중요하게 남은 이유는 무엇인가요?",
      "그 일은 당신에게 어떤 의미로 남아 있나요?",
    ],
  },

  wish: {
    anchored: [
      "그 '{anchor}'과 관련해 지금 마음이 바라는 것은 무엇인가요?",
      "그 '{anchor}'의 흐름이 앞으로 어떻게 이어지기를 바라나요?",
    ],
    neutral: [
      "지금 마음이 가장 바라는 방향은 무엇인가요?",
      "이 흐름이 앞으로 어떻게 이어지기를 바라나요?",
    ],
  },
};

export default SLOT_QUESTIONS;