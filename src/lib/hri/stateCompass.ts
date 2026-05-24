export type StateValence = "positive" | "negative" | "mixed" | "neutral";
export type StateActivation = "calm" | "tired" | "pressed" | "scattered" | "subdued";
export type StateAnchor = "body" | "emotion" | "thought" | "time" | "relationship" | "loss" | "unclear";
export type StateNeed = "restore" | "clarify" | "prioritize" | "continue" | "hold" | "unknown";
export type StatePressure = "low" | "medium" | "high";
export type QuestionPosture = "grounding" | "clarifying" | "prioritizing" | "continuing" | "holding";

export interface StateCompass {
  valence: StateValence;
  activation: StateActivation;
  anchor: StateAnchor;
  need: StateNeed;
  pressure: StatePressure;
  posture: QuestionPosture;
  keywords: string[];
}

const POSITIVE_WORDS = [
  "기쁘",
  "좋",
  "즐겁",
  "희망",
  "기대",
  "안심",
  "상쾌",
  "편안",
  "괜찮",
  "잘",
  "여유",
] as const;

const NEGATIVE_WORDS = [
  "슬프",
  "불안",
  "걱정",
  "힘들",
  "무겁",
  "피곤",
  "지쳤",
  "압박",
  "두렵",
  "막막",
  "아프",
  "상실",
] as const;

const BODY_WORDS = ["몸", "피곤", "잠", "무겁", "아프", "쉬", "호흡", "가슴", "어깨", "머리"] as const;
const TIME_WORDS = ["시간", "일정", "기한", "준비", "촉박", "밀렸", "마감", "런칭", "출시", "베타"] as const;
const THOUGHT_WORDS = ["생각", "정리", "판단", "결정", "계획", "걱정", "고민"] as const;
const RELATION_WORDS = ["사람", "가족", "친구", "동료", "상사", "팀", "관계", "말", "눈치"] as const;
const LOSS_WORDS = ["저 세상", "세상으로 갔", "떠났", "죽", "사망", "상실", "이별", "장례", "애도", "그립", "잃었", "잃은"] as const;
const PRESSURE_WORDS = ["압박", "촉박", "기한", "마감", "밀렸", "부족", "급하", "준비", "완성", "걱정"] as const;

function hitCount(text: string, words: readonly string[]) {
  return words.reduce((count, word) => count + (text.includes(word) ? 1 : 0), 0);
}

function extractKeywords(inputs: string[]) {
  return inputs
    .join(" ")
    .split(/[\s,.;!?/]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2)
    .slice(0, 8);
}

export function analyzeStateCompass(inputs: string[]): StateCompass {
  const text = inputs.join(" ");

  const positive = hitCount(text, POSITIVE_WORDS);
  const negative = hitCount(text, NEGATIVE_WORDS);
  const body = hitCount(text, BODY_WORDS);
  const time = hitCount(text, TIME_WORDS);
  const thought = hitCount(text, THOUGHT_WORDS);
  const relation = hitCount(text, RELATION_WORDS);
  const loss = hitCount(text, LOSS_WORDS);
  const pressureScore = hitCount(text, PRESSURE_WORDS);

  let valence: StateValence = "neutral";
  if (positive > 0 && negative > 0) valence = "mixed";
  else if (positive > 0) valence = "positive";
  else if (negative > 0 || loss > 0) valence = "negative";

  let anchor: StateAnchor = "unclear";
  if (loss > 0) anchor = "loss";
  else if (body >= Math.max(time, thought, relation) && body > 0) anchor = "body";
  else if (time >= Math.max(body, thought, relation) && time > 0) anchor = "time";
  else if (relation >= Math.max(body, time, thought) && relation > 0) anchor = "relationship";
  else if (thought > 0) anchor = "thought";
  else if (positive + negative > 0) anchor = "emotion";

  const pressure: StatePressure = pressureScore >= 2 ? "high" : pressureScore === 1 ? "medium" : "low";

  let activation: StateActivation = "calm";
  if (anchor === "loss") activation = "subdued";
  else if (pressure === "high") activation = "pressed";
  else if (body > 0 && negative > 0) activation = "tired";
  else if (valence === "mixed") activation = "scattered";

  let need: StateNeed = "unknown";
  if (anchor === "loss") need = "hold";
  else if (pressure === "high" || anchor === "time") need = "prioritize";
  else if (anchor === "body") need = "restore";
  else if (valence === "positive") need = "continue";
  else if (anchor !== "unclear") need = "clarify";

  let posture: QuestionPosture = "clarifying";
  if (need === "hold") posture = "holding";
  else if (need === "prioritize") posture = "prioritizing";
  else if (need === "restore") posture = "grounding";
  else if (need === "continue") posture = "continuing";

  return {
    valence,
    activation,
    anchor,
    need,
    pressure,
    posture,
    keywords: extractKeywords(inputs),
  };
}
