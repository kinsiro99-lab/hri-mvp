import type { StateCompass } from "./stateCompass";

/**
 * HRI internal layer.
 *
 * This file links early state-reading results to the first main-question lane.
 * It is intentionally kept away from UI copy and public product language.
 * The UI may display only the selected question, never this decision table.
 */
export type MainQuestionLane =
  | "grief-holding"
  | "pressure-prioritization"
  | "positive-continuity"
  | "body-recovery"
  | "emotion-clarification"
  | "relationship-orientation"
  | "self-boundary"
  | "mixed-compass"
  | "open-orientation";

export interface MainQuestionSeed {
  lane: MainQuestionLane;
  question: string;
  confidence: number;
}

type SignalScore = {
  lane: MainQuestionLane;
  score: number;
};

const containsAny = (text: string, words: readonly string[]) =>
  words.some((word) => text.includes(word));

const LOSS_WORDS = [
  "저 세상",
  "세상으로 갔",
  "떠났",
  "죽",
  "사망",
  "상실",
  "이별",
  "장례",
  "애도",
  "그립",
  "잃었",
  "잃은",
  "슬픔",
  "슬프",
] as const;

const RELATION_WORDS = [
  "사람",
  "가족",
  "친구",
  "동료",
  "회사",
  "상사",
  "팀",
  "관계",
  "말",
  "눈치",
] as const;

const BODY_WORDS = [
  "몸",
  "피곤",
  "잠",
  "무겁",
  "아프",
  "쉬",
  "호흡",
  "가슴",
  "어깨",
  "머리",
] as const;

const PRESSURE_WORDS = [
  "촉박",
  "압박",
  "기한",
  "일정",
  "준비",
  "완성",
  "밀렸",
  "밀린",
  "부족",
  "걱정",
  "급하",
] as const;

const POSITIVE_WORDS = [
  "기쁘",
  "좋",
  "즐겁",
  "희망",
  "기대",
  "안심",
  "편안",
  "상쾌",
  "괜찮",
  "잘",
] as const;

function scoreSignals(compass: StateCompass, joinedInput: string): SignalScore[] {
  const scores: SignalScore[] = [
    { lane: "grief-holding", score: 0 },
    { lane: "pressure-prioritization", score: 0 },
    { lane: "positive-continuity", score: 0 },
    { lane: "body-recovery", score: 0 },
    { lane: "relationship-orientation", score: 0 },
    { lane: "emotion-clarification", score: 0 },
    { lane: "self-boundary", score: 0 },
    { lane: "mixed-compass", score: 0 },
    { lane: "open-orientation", score: 1 },
  ];

  const add = (lane: MainQuestionLane, value: number) => {
    const target = scores.find((item) => item.lane === lane);
    if (target) target.score += value;
  };

  if (compass.anchor === "loss") add("grief-holding", 5);
  if (containsAny(joinedInput, LOSS_WORDS)) add("grief-holding", 4);

  if (compass.pressure === "high") add("pressure-prioritization", 3);
  if (compass.need === "prioritize") add("pressure-prioritization", 3);
  if (compass.anchor === "time") add("pressure-prioritization", 2);
  if (containsAny(joinedInput, PRESSURE_WORDS)) add("pressure-prioritization", 3);

  if (compass.valence === "positive") add("positive-continuity", 4);
  if (compass.need === "continue") add("positive-continuity", 2);
  if (containsAny(joinedInput, POSITIVE_WORDS)) add("positive-continuity", 2);

  if (compass.anchor === "body") add("body-recovery", 4);
  if (compass.need === "restore") add("body-recovery", 2);
  if (containsAny(joinedInput, BODY_WORDS)) add("body-recovery", 3);

  if (compass.anchor === "relationship") add("relationship-orientation", 4);
  if (containsAny(joinedInput, RELATION_WORDS)) add("relationship-orientation", 1);

  if (compass.anchor === "emotion") add("emotion-clarification", 3);
  if (compass.activation === "scattered") add("emotion-clarification", 2);

  if (compass.pressure === "high" && compass.valence === "positive") add("mixed-compass", 3);
  if (compass.activation === "pressed" && compass.need === "continue") add("mixed-compass", 2);

  return scores.sort((a, b) => b.score - a.score);
}

function questionForLane(lane: MainQuestionLane, compass: StateCompass): string {
  switch (lane) {
    case "grief-holding":
      return "그 상실감이 지금 가장 크게 머무는 곳은 마음, 몸, 관계 중 어디에 가까울까요?";

    case "pressure-prioritization":
      if (compass.valence === "positive") {
        return "기대와 압박이 함께 있다면, 지금 먼저 보호해야 할 것은 시간, 완성도, 마음의 여유 중 무엇일까요?";
      }
      return "지금의 압박 속에서 가장 먼저 정리되어야 할 것은 시간, 일의 순서, 마음의 부담 중 무엇일까요?";

    case "positive-continuity":
      return "이 좋은 흐름이 억지로 붙잡는 일이 되지 않으려면, 지금 무엇을 그대로 두면 좋을까요?";

    case "body-recovery":
      return "몸이 먼저 신호를 보내고 있다면, 지금 가장 회복이 필요한 곳은 긴장, 피로, 호흡 중 어디에 가까울까요?";

    case "relationship-orientation":
      return "그 관계의 흐름 안에서 지금 가장 조심히 살펴야 할 것은 거리, 말, 기대 중 무엇일까요?";

    case "emotion-clarification":
      return "지금 여러 감각이 섞여 있다면, 가장 먼저 이름 붙일 수 있는 감정은 무엇일까요?";

    case "self-boundary":
      return "지금 나를 지키기 위해 가장 먼저 분리해야 할 것은 책임, 감정, 시선 중 무엇일까요?";

    case "mixed-compass":
      return "서로 다른 감정이 함께 있다면, 지금 더 크게 방향을 잡고 있는 쪽은 기대인가요, 부담인가요?";

    case "open-orientation":
    default:
      return "지금 이 흐름에서 가장 먼저 분명하게 확인하고 싶은 것은 무엇인가요?";
  }
}

export function selectMainQuestionFromCompass(compass: StateCompass, inputs: string[]): MainQuestionSeed {
  const joinedInput = inputs.join(" ");
  const [top, second] = scoreSignals(compass, joinedInput);
  const lane = top?.lane ?? "open-orientation";
  const scoreGap = top && second ? Math.max(0, top.score - second.score) : 0;
  const confidence = Math.min(0.95, Math.max(0.45, 0.55 + scoreGap * 0.08));

  return {
    lane,
    question: questionForLane(lane, compass),
    confidence,
  };
}
