import type { QuestionCategory, RhythmVectorScores } from "./types";

export type QuestionSeed = {
  id: string;
  text: string;
  category: QuestionCategory;
  allowedVectors: Array<keyof RhythmVectorScores>;
  minTurn?: number;
  maxTurn?: number;
  avoidAfter?: QuestionCategory[];
  weight: number;
};

export const questionSeeds: QuestionSeed[] = [
  {
    id: "sensory-01",
    category: "sensory",
    text: "그 안에서 가장 선명한 감각은 무엇인가요?",
    allowedVectors: ["collapse", "pressure", "numbness", "fragmentation"],
    maxTurn: 2,
    weight: 0.42,
  },
  {
    id: "sensory-02",
    category: "sensory",
    text: "몸에서는 어디가 가장 먼저 반응하나요?",
    allowedVectors: ["pressure", "collapse", "selfBlame"],
    weight: 0.38,
  },
  {
    id: "temporal-01",
    category: "temporal",
    text: "그 느낌이 가장 가까워지는 순간은 언제 같나요?",
    allowedVectors: ["looping", "avoidance", "pressure", "collapse"],
    minTurn: 1,
    weight: 0.44,
  },
  {
    id: "directional-01",
    category: "directional",
    text: "그 흐름은 안쪽으로 향하나요, 바깥으로 향하나요?",
    allowedVectors: ["inwardMotion", "outwardMotion", "pressure", "collapse"],
    minTurn: 1,
    weight: 0.48,
  },
  {
    id: "density-01",
    category: "density",
    text: "지금 안에서 가장 무거운 건 무엇 같나요?",
    allowedVectors: ["collapse", "pressure", "selfBlame"],
    minTurn: 1,
    weight: 0.5,
  },
  {
    id: "fragmentation-01",
    category: "fragmentation",
    text: "지금 가장 흩어지는 건 생각인가요, 감각인가요?",
    allowedVectors: ["fragmentation", "numbness", "looping"],
    weight: 0.46,
  },
  {
    id: "boundary-01",
    category: "boundary",
    text: "지금은 붙잡고 싶은 쪽인가요, 밀어내고 싶은 쪽인가요?",
    allowedVectors: ["avoidance", "pressure", "outwardMotion", "inwardMotion"],
    minTurn: 1,
    weight: 0.4,
  },
  {
    id: "silence-01",
    category: "silence",
    text: "말로 붙잡기 어려운 부분이 있다면, 그 가장자리만 적어도 괜찮습니다.",
    allowedVectors: ["numbness", "collapse", "fragmentation"],
    weight: 0.36,
  },
];
