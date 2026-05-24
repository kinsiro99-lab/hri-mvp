import type { HriEvent, QuestionCategory, QuestionOutput, SessionState } from "./types";
import { detectContextAnchors, type HriContextAnchor, type PositiveSignal } from "./contextAnchors";

function stableId(parts: string[]): string {
  return parts.join("-").replace(/[^a-zA-Z0-9가-힣_-]+/g, "_").slice(0, 90);
}

type QuestionCandidate = {
  id: string;
  text: string;
  category: QuestionCategory;
  aperture: "small" | "medium";
  weight: number;
};

const categoryByAnchor: Record<HriContextAnchor, QuestionCategory> = {
  lowSignal: "sensory",
  positive: "sensory",
  reliefWish: "density",
  fatigue: "sensory",
  workload: "density",
  launchPressure: "density",
  deadlinePressure: "temporal",
  uncertainty: "temporal",
  delay: "temporal",
  body: "sensory",
  conflict: "boundary",
  general: "density",
};

const positiveStageQuestions: Record<PositiveSignal, Record<number, string[]>> = {
  joy: {
    1: ["그 좋은 느낌은 어디에서 먼저 오나요?", "그 기쁨은 몸 쪽인가요, 마음 쪽인가요?"],
    2: ["그 느낌이 계속 머물려면 무엇이 필요할까요?", "그 기분을 해치지 않는 조건은 무엇인가요?"],
  },
  calm: {
    1: ["그 여유는 어디에서 먼저 느껴지나요?", "편안함은 몸, 마음, 상황 중 어디에 가깝나요?"],
    2: ["그 여유를 그대로 두려면 무엇이 필요할까요?", "지금 건드리지 말아야 할 것은 무엇인가요?"],
  },
  hope: {
    1: ["그 기대는 어떤 장면에서 선명한가요?", "앞으로의 기대는 어디에서 먼저 올라오나요?"],
    2: ["그 기대가 이어지려면 무엇이 안정돼야 하나요?", "희망을 현실 쪽으로 붙잡는 조건은 무엇인가요?"],
  },
  flow: {
    1: ["잘 풀린다는 느낌은 어디에서 확인되나요?", "그 순조로움은 무엇에서 가장 선명한가요?"],
    2: ["그 흐름을 막지 않으려면 무엇이 필요할까요?", "지금 그대로 두어야 할 흐름은 무엇인가요?"],
  },
  relief: {
    1: ["가벼워진 느낌은 어디서 먼저 느껴지나요?", "무엇이 줄어들며 편해진 것 같나요?"],
    2: ["그 가벼움이 이어지려면 무엇이 더 줄어야 하나요?", "편해진 상태를 지키려면 무엇이 필요할까요?"],
  },
  none: {
    1: ["그 느낌은 어디에서 먼저 오나요?", "지금 가장 선명한 좋은 감각은 무엇인가요?"],
    2: ["그 흐름이 이어지려면 무엇이 필요할까요?", "그 상태를 해치지 않는 조건은 무엇인가요?"],
  },
};

const stageQuestions: Record<HriContextAnchor, Record<number, string[]>> = {
  lowSignal: {
    1: ["방금 적은 말에서, 의미보다 먼저 남는 감각은 무엇인가요?"],
    2: ["그 감각을 한 단어로만 잡는다면 무엇에 가깝나요?"],
  },
  positive: positiveStageQuestions.none,
  reliefWish: {
    1: ["덜어지길 바라는 것은 양인가요, 압박인가요?", "무엇이 줄면 가장 먼저 숨이 트일까요?"],
    2: ["조금 가벼워지려면 무엇부터 줄어야 하나요?", "그 부담은 어디에서 가장 크게 느껴지나요?"],
  },
  fatigue: {
    1: ["피곤함은 몸 쪽인가요, 생각 쪽인가요?"],
    2: ["지금 피로가 가장 먼저 느껴지는 곳은 몸, 생각, 마음 중 어디에 가까울까요?"],
  },
  workload: {
    1: ["그 일에서 지금 가장 걸리는 지점은 무엇인가요?"],
    2: ["양, 순서, 완성도 중 어디가 더 무겁나요?"],
  },
  launchPressure: {
    1: ["그 일정 앞에서 먼저 올라온 느낌은 무엇인가요?"],
    2: ["압박은 시간, 완성도, 기대 중 어디에 가깝나요?"],
  },
  deadlinePressure: {
    1: ["가장 촉박하게 느껴지는 것은 무엇인가요?"],
    2: ["시간, 준비, 완성도 중 어디가 더 압박인가요?"],
  },
  uncertainty: {
    1: ["지금 가장 불확실한 지점은 무엇인가요?"],
    2: ["그 불확실함은 무엇을 확인하면 낮아질까요?"],
  },
  delay: {
    1: ["늦어졌다는 느낌은 어디에서 가장 크게 오나요?"],
    2: ["다시 흐르려면 무엇이 먼저 풀려야 하나요?"],
  },
  body: {
    1: ["그 감각은 몸 어디에서 가장 먼저 느껴지나요?"],
    2: ["그 몸의 느낌이 낮아지려면 무엇이 필요할까요?"],
  },
  conflict: {
    1: ["그 불편함은 어느 지점에서 시작된 것 같나요?"],
    2: ["지금 가장 먼저 인정해야 할 감정은 무엇인가요?"],
  },
  general: {
    1: ["지금 가장 선명하게 남는 느낌은 무엇인가요?"],
    2: ["그 느낌은 어디로 향하고 있는 것 같나요?"],
  },
};

const mixedPositivePressureQuestions: Record<number, string[]> = {
  1: [
    "좋은 느낌과 부담 중 무엇이 먼저 오나요?",
    "지금은 기대와 압박 중 어디에 더 가깝나요?",
  ],
  2: [
    "좋은 흐름을 지키려면 무엇이 안정돼야 하나요?",
    "그 부담은 좋은 흐름을 돕나요, 누르나요?",
  ],
};

const mixedLaunchQuestions: Record<number, string[]> = {
  1: ["기쁨과 압박 중 무엇이 더 선명한가요?", "그 일정 앞에서 먼저 올라온 느낌은 무엇인가요?"],
  2: ["그 압박은 기대를 살리나요, 누르나요?", "압박은 시간, 완성도, 기대 중 어디에 가깝나요?"],
};

function buildCandidates(state: SessionState, events: HriEvent[]): QuestionCandidate[] {
  const anchorResult = detectContextAnchors(events);
  const stage = Math.max(1, Math.min(2, state.turnCount));
  const anchor = anchorResult.anchor;
  const isMixed = anchorResult.tone === "mixed";
  const positiveSet = positiveStageQuestions[anchorResult.positiveSignal] ?? positiveStageQuestions.none;
  const primaryQuestions =
    isMixed && anchor === "launchPressure"
      ? mixedLaunchQuestions[stage] ?? []
      : isMixed
        ? mixedPositivePressureQuestions[stage] ?? []
        : anchor === "positive"
          ? positiveSet[stage] ?? []
          : stageQuestions[anchor]?.[stage] ?? [];
  const fallbackQuestions = stageQuestions.general[stage] ?? [];
  const category = isMixed ? "density" : categoryByAnchor[anchor] ?? "density";

  return [...primaryQuestions, ...fallbackQuestions].map((text, index) => ({
    id: stableId([
      "q",
      isMixed ? "mixed" : anchor,
      anchorResult.positiveSignal,
      String(stage),
      String(index),
      text,
    ]),
    text,
    category,
    aperture: category === "density" || category === "temporal" ? "medium" : "small",
    weight: index === 0 ? 1 : 0.72,
  }));
}

export function selectNextQuestion(state: SessionState, events: HriEvent[] = []): QuestionOutput {
  const candidates = buildCandidates(state, events);
  const used = new Set(state.usedQuestionIds ?? []);
  const candidate = candidates.find((item) => !used.has(item.id)) ?? candidates[0];

  return candidate ?? {
    id: "q-safe-fallback",
    text: "그 안에서 지금 가장 선명하게 남는 느낌은 무엇인가요?",
    category: "density",
    aperture: "small",
    weight: 0.5,
  };
}
