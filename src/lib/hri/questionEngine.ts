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
  1: [
    "그 흐름은 어떤 상황에서 가장 선명해지나요?",
    "최근 가장 자연스럽게 이어지는 흐름은 무엇인가요?"
  ],
  2: [
    "그 흐름이 계속 이어지려면 무엇이 유지되어야 하나요?",
    "지금 그 방향을 흔드는 요소는 무엇인가요?"
  ],
},

calm: {
  1: [
    "최근 가장 안정적으로 느껴졌던 순간은 언제였나요?",
    "지금 흐름이 비교적 정돈되는 지점은 어디인가요?"
  ],
  2: [
    "그 안정감을 유지하려면 무엇이 필요할까요?",
    "현재 흐름을 다시 흔들 가능성이 큰 요소는 무엇인가요?"
  ],
},

hope: {
  1: [
    "앞으로의 흐름이 가장 긍정적으로 보이는 지점은 어디인가요?",
    "최근 기대감이 다시 살아난 계기가 있었나요?"
  ],
  2: [
    "그 방향이 현실로 이어지려면 무엇이 먼저 정리되어야 하나요?",
    "지금 가장 먼저 안정되어야 하는 조건은 무엇인가요?"
  ],
},

flow: {
  1: [
    "최근 가장 자연스럽게 이어지고 있는 흐름은 무엇인가요?",
    "지금 가장 막힘 없이 움직이는 영역은 어디인가요?"
  ],
  2: [
    "그 흐름을 유지하려면 무엇을 놓치지 말아야 하나요?",
    "현재 흐름을 끊을 가능성이 있는 요소는 무엇인가요?"
  ],
},

relief: {
  1: [
    "최근 가장 줄어든 압박은 무엇인가요?",
    "무엇이 정리되면서 흐름이 조금 가벼워졌나요?"
  ],
  2: [
    "그 상태를 유지하려면 무엇이 더 안정되어야 하나요?",
    "다시 압박이 커질 가능성이 있는 부분은 어디인가요?"
  ],
},
  none: {
    1: ["그 느낌은 어디에서 먼저 오나요?", "지금 가장 선명한 좋은 감각은 무엇인가요?"],
    2: ["그 흐름이 이어지려면 무엇이 필요할까요?", "그 상태를 해치지 않는 조건은 무엇인가요?"],
  },
};

const stageQuestions: Record<HriContextAnchor, Record<number, string[]>> = {
 lowSignal: {
  1: [
    "지금 가장 먼저 떠오르는 흐름은 무엇인가요?",
    "현재 가장 오래 머무르는 생각은 무엇인가요?"
  ],
  2: [
    "지금 흐름이 가장 자주 향하는 방향은 어디인가요?",
    "현재 가장 반복되고 있는 패턴은 무엇인가요?"
  ],
},
  positive: positiveStageQuestions.none,
 reliefWish: {
  1: [
    "현재 가장 먼저 정리되어야 할 흐름은 무엇인가요?",
    "지금 흐름을 가장 무겁게 만드는 요소는 무엇인가요?"
  ],
  2: [
    "흐름이 다시 가벼워지려면 무엇이 먼저 줄어들어야 하나요?",
    "현재 가장 우선적으로 비워야 할 부분은 어디인가요?"
  ],
},

fatigue: {
  1: [
    "현재 흐름이 가장 둔해지는 지점은 어디인가요?",
    "반복적으로 에너지가 끊기는 상황은 언제 나타나나요?"
  ],
  2: [
    "지금 흐름 회복을 가장 방해하는 요소는 무엇인가요?",
    "현재 가장 먼저 정리되어야 할 부담은 무엇인가요?"
  ],
},

workload: {
  1: [
    "현재 흐름이 가장 자주 멈추는 지점은 어디인가요?",
    "지금 가장 복잡하게 얽혀 있는 요소는 무엇인가요?"
  ],
  2: [
    "우선순위가 가장 흔들리는 부분은 어디인가요?",
    "양, 속도, 완성도 중 현재 가장 압박이 큰 요소는 무엇인가요?"
  ],
},

launchPressure: {
  1: [
    "앞으로의 흐름에서 가장 압박이 커지는 지점은 어디인가요?",
    "현재 가장 신경이 집중되는 조건은 무엇인가요?"
  ],
  2: [
    "지금 가장 먼저 안정되어야 하는 요소는 무엇인가요?",
    "현재 흐름을 흔드는 기대 또는 부담은 무엇인가요?"
  ],
},

deadlinePressure: {
  1: [
    "현재 가장 압박이 커지는 조건은 무엇인가요?",
    "시간 흐름이 가장 빠르게 무너지는 지점은 어디인가요?"
  ],
  2: [
    "지금 가장 먼저 점검되어야 할 요소는 무엇인가요?",
    "준비, 시간, 완성도 중 가장 불안정한 부분은 어디인가요?"
  ],
},

uncertainty: {
  1: [
    "현재 판단이 계속 흔들리는 지점은 어디인가요?",
    "무엇이 흐름의 방향을 가장 불분명하게 만들고 있나요?"
  ],
  2: [
    "지금 가장 먼저 분명해져야 하는 조건은 무엇인가요?",
    "판단을 계속 지연시키는 요소는 무엇인가요?"
  ],
},
 delay: {
  1: [
    "결정을 반복해서 미루게 되는 지점은 어디인가요?",
    "생각은 이어지지만 실행이 멈추는 이유는 무엇인가요?"
  ],
  2: [
    "현재 흐름을 가장 오래 붙잡고 있는 hesitation은 무엇인가요?",
    "지금 판단 속도를 가장 늦추는 요소는 무엇인가요?"
  ],
},
 body: {
  1: [
    "그 감각은 몸 어디에서 가장 먼저 느껴지나요?"
  ],
  2: [
    "몸의 흐름이 조금 더 편안해지려면 무엇이 필요할까요?"
  ],
},
  conflict: {
  1: [
    "충돌이 가장 자주 반복되는 상황은 언제인가요?",
    "현재 서로 다른 방향으로 끌리는 요소는 무엇인가요?"
  ],
  2: [
    "흐름이 계속 분산되는 원인은 무엇인가요?",
    "지금 가장 먼저 정리되어야 할 충돌은 무엇인가요?"
  ],
},
general: {
  1: [
    "지금 가장 먼저 떠오르는 감각은 무엇인가요?"
  ],
  2: [
    "그 흐름을 조금 더 분명하게 만들려면 무엇이 필요할까요?"
  ],
},
};
const mixedLaunchQuestions: Record<number, string[]> = {
  1: [
    "기쁨과 긴장감 중 무엇이 더 선명한가요?",
    "그 일정 앞에서 가장 먼저 떠오르는 것은 무엇인가요?"
  ],

  2: [
    "그 긴장감은 흐름을 밀어주나요, 멈추게 하나요?",
    "시간, 완성도, 기대 중 지금 가장 크게 의식되는 것은 무엇인가요?",
 ]
};
function buildCandidates(state: SessionState, events: HriEvent[]): QuestionCandidate[] {
  const anchorResult = detectContextAnchors(events);

  const stage = Math.min(2, state.turnCount);
  const anchor = anchorResult.anchor;
  const isMixed = anchorResult.tone === "mixed";
  const positiveSet = positiveStageQuestions[anchorResult.positiveSignal] ?? positiveStageQuestions.none;
  const primaryQuestions =
    isMixed && anchor === "launchPressure"
      ? mixedLaunchQuestions[stage] ?? []
      : isMixed
        ? ? positiveSet[stage] ?? []
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
