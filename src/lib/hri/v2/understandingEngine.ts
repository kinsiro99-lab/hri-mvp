import type { Slot } from "./types.v2";
import { devLog } from "../../devLog";
import type { Evidence } from "./evidence";
export type UnderstandingState = {
  topic?: string;
  target?: string;
  emotion?: string;
  relationship?: string;
  presentState?: string;
  meaning?: string;
  wish?: string;
  memoryTone?: "positive" | "negative" | "mixed";
};

export type UnderstandingCoverage = {
  topic: boolean;
  target: boolean;
  emotion: boolean;
  relationship: boolean;
  presentState: boolean;
  meaning: boolean;
  wish: boolean;
};


export type UnderstandingUpdate = {
  next: UnderstandingState;
  coverage: UnderstandingCoverage;
};

function has(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

/* =========================================================
 * Semantic Groups
 * 새 표현은 이 배열에만 추가한다.
 * 판정 함수는 개별 단어가 아니라 의미군만 참조한다.
 * ========================================================= */

export const SEMANTIC_GROUPS = {
  work: {
    workload: [
      "일들이 많",
      "할 일이 많",
      "할일이 많",
      "업무가 많",
      "업무가 밀",
      "일이 밀",
      "일감",
      "업무",
      "회사",
      "계획",
      "일정",
      "목표",
      "성과",
      "과제",
      "프로젝트",
      "처리할",
      "쌓여",
      "쌓인",
      "산더미",
    ],
    timePressure: [
      "쉴 시간이 없",
      "쉴시간이 없",
      "쉴 수가 없",
      "쉴수가 없",
      "쉴 수 없",
      "시간이 부족",
      "시간이 없",
      "시간에 쫓",
      "일정에 쫓",
      "쫓기",
      "마감",
      "여유가 없",
      "여유 없",
      "바쁘",
      "정신이 없",
      "정신없",
    ],
    stress: [
      "스트레스",
      "압박",
      "압박감",
      "부담",
      "답답",
      "속막",
      "속 막",
      "짓눌",
      "버겁",
      "벅차",
      "버티기 힘",
      "지친",
      "지쳐",
      "짓눌리",
      "막막",
      "무겁",
      "혼란",
      "어지럽",
    ],
    blockage: [
      "진전이 안",
      "진전 안",
      "진행이 안",
      "진행 안",
      "안 풀",
      "안풀",
      "막힘",
      "막혀",
      "정체",
      "어긋",
      "꼬였",
      "틀어짐",
      "계획의 어긋남",
      "혼란스러움",
      "발생",
    ],
    deprivation: [
      "쉴 수",
      "쉴수",
      "쉬지 못",
      "휴식",
      "잠을 못",
      "잠 못",
      "여유",
      "숨 돌릴",
    ],
  },

  relationship: {
    person: [
      "친구",
      "옛 친구",
      "사람",
      "그 사람",
      "옛 사람",
      "아이",
      "자녀",
      "가족",
      "부모",
      "동료",
      "상사",
    ],
    separation: [
      "연락이 안",
      "연락이 끊",
      "연락 끊",
      "연락이 뜸",
      "끊겼",
      "끊어",
      "끊긴",
      "멀어",
      "헤어",
      "떨어",
      "떠난",
    ],
   longing: [
  "보고싶",
  "보고 싶",
  "그립",
  "그리움",
],
    warmth: [
      "따뜻",
      "좋았",
      "즐거",
      "행복",
      "소중",
      "고마",
      "편안",
    
    ],
  },

  memory: {
    scene: [
      "기억",
      "추억",
      "옛 생각",
      "장면",
      "풍경",
      "모습",
      "시간",
      "시절",
      "그때",
      "대화",
      "이야기",
    ],
    positive: [
      "즐겁",
      "좋았",
      "행복",
      "따뜻",
      "아름",
      "편안",
      "만족",
      "기쁘",
      "뿌듯",
    ],
    regret: [
      "후회",
      "미안",
      "아프",
      "슬프",
      "외롭",
      "아쉬",
      "안타깝",
    ],
    // Context evidence, not a signal on its own (see isMemorySignal —
    // deliberately NOT included there). Only consulted by updateTopic's
    // resolver as a tie-break when "기억" already has real core evidence
    // (e.g. the "아프" overlap with health.pain) tied against another
    // topic — never enough by itself to create a "기억" candidate.
    pastContext: [
      "옛일",
      "지난 일",
    ],
  },

  health: {
    fatigue: [
      "피곤",
      "지침",
      "지친",
      "기운이 없",
      "무기력",
      "탈진",
      "잠이 부족",
    ],
    pain: [
      "아프",
      "통증",
      "두통",
      "몸살",
      "불편",
      "답답",
    ],
    recovery: [
      "회복",
      "쉬고 싶",
      "쉬고싶",
      "나아지고",
      "괜찮아지고",
    ],
    // Context evidence, not a signal on its own (see isHealthSignal —
    // deliberately NOT included there). Only consulted by updateTopic's
    // resolver as a tie-break when "몸 상태" already has real core
    // evidence tied against another topic — a bare body-part mention
    // ("머리를 잘랐다") can never alone flip topic to health.
    bodyContext: [
      "머리",
      "몸",
      "배",
      "허리",
      "어깨",
      "다리",
      "무릎",
      "가슴",
      "목",
    ],
  },
} as const;

function inList(text: string, words: readonly string[]): boolean {
  return has(text, words);
}

function inWork(text: string, group: keyof typeof SEMANTIC_GROUPS.work): boolean {
  return inList(text, SEMANTIC_GROUPS.work[group]);
}

function inRelationship(
  text: string,
  group: keyof typeof SEMANTIC_GROUPS.relationship,
): boolean {
  return inList(text, SEMANTIC_GROUPS.relationship[group]);
}

function inMemory(text: string, group: keyof typeof SEMANTIC_GROUPS.memory): boolean {
  return inList(text, SEMANTIC_GROUPS.memory[group]);
}

function inHealth(text: string, group: keyof typeof SEMANTIC_GROUPS.health): boolean {
  return inList(text, SEMANTIC_GROUPS.health[group]);
}

function isWorkSignal(text: string): boolean {
  return (
    inWork(text, "workload") ||
    inWork(text, "timePressure") ||
    inWork(text, "stress") ||
    inWork(text, "blockage")
  );
}

function isPressure(text: string): boolean {
  return (
    inWork(text, "timePressure") ||
    inWork(text, "stress") ||
    inWork(text, "blockage") ||
    has(text, ["시일", "공개", "출시", "오픈", "베타", "발표", "일정", "런칭", "마감", "기한"])
  );
}

function isRelationshipSignal(text: string): boolean {
  return (
    inRelationship(text, "person") ||
    inRelationship(text, "separation") ||
    inRelationship(text, "longing") ||
    inRelationship(text, "warmth")
  );
}

function isMemorySignal(text: string): boolean {
  return (
    inMemory(text, "scene") ||
    inMemory(text, "positive") ||
    inMemory(text, "regret")
  );
}

function isHealthSignal(text: string): boolean {
  return (
    inHealth(text, "fatigue") ||
    inHealth(text, "pain") ||
    inHealth(text, "recovery")
  );
}

/* =========================================================
 * Topic resolver — Evidence-based candidate collection.
 *
 * Replaces the old if-else-if first-match chain (work > relationship >
 * memory > health > future), which meant a word shared by two groups
 * (e.g. "아프" in both memory.regret and health.pain) always resolved
 * to whichever group happened to be checked first in the code, with no
 * regard for which group actually fit the sentence.
 *
 * Every group with real core evidence becomes a candidate; ties are
 * broken by context evidence (health.bodyContext / memory.pastContext —
 * words that on their own never create a candidate, only disambiguate
 * one that already exists); ties that survive that fall back to the
 * original group order, so any input that used to match exactly one
 * group resolves identically to before.
 * ========================================================= */

type TopicName = "업무 압박" | "관계" | "기억" | "몸 상태";

const TOPIC_PRIORITY: readonly TopicName[] = ["업무 압박", "관계", "기억", "몸 상태"];

const TOPIC_GROUP_WORDS: Record<TopicName, readonly string[]> = {
  "업무 압박": [
    ...SEMANTIC_GROUPS.work.workload,
    ...SEMANTIC_GROUPS.work.timePressure,
    ...SEMANTIC_GROUPS.work.stress,
    ...SEMANTIC_GROUPS.work.blockage,
  ],
  "관계": [
    ...SEMANTIC_GROUPS.relationship.person,
    ...SEMANTIC_GROUPS.relationship.separation,
    ...SEMANTIC_GROUPS.relationship.longing,
    ...SEMANTIC_GROUPS.relationship.warmth,
  ],
  "기억": [
    ...SEMANTIC_GROUPS.memory.scene,
    ...SEMANTIC_GROUPS.memory.positive,
    ...SEMANTIC_GROUPS.memory.regret,
  ],
  "몸 상태": [
    ...SEMANTIC_GROUPS.health.fatigue,
    ...SEMANTIC_GROUPS.health.pain,
    ...SEMANTIC_GROUPS.health.recovery,
  ],
};

function countMatches(text: string, words: readonly string[]): number {
  return words.filter((word) => text.includes(word)).length;
}

type ScoredTopicEvidence = {
  evidence: Evidence;
  coreScore: number;
  contextScore: number;
};

function collectTopicEvidence(text: string): ScoredTopicEvidence[] {
  const results: ScoredTopicEvidence[] = [];

  for (const name of TOPIC_PRIORITY) {
    const coreScore = countMatches(text, TOPIC_GROUP_WORDS[name]);
    if (coreScore === 0) continue;

    const contextScore =
      name === "기억"
        ? countMatches(text, SEMANTIC_GROUPS.memory.pastContext)
        : name === "몸 상태"
          ? countMatches(text, SEMANTIC_GROUPS.health.bodyContext)
          : 0;

    results.push({
      evidence: { value: name, kind: "inferred", sourceText: text, matchedGroup: name },
      coreScore,
      contextScore,
    });
  }

  return results;
}

function resolveTopic(scored: ScoredTopicEvidence[]): Evidence | undefined {
  if (scored.length === 0) return undefined;

  const maxCore = Math.max(...scored.map((s) => s.coreScore));
  const topByCore = scored.filter((s) => s.coreScore === maxCore);
  if (topByCore.length === 1) return topByCore[0].evidence;

  const maxContext = Math.max(...topByCore.map((s) => s.contextScore));
  const topByContext = topByCore.filter((s) => s.contextScore === maxContext);
  if (topByContext.length === 1) return topByContext[0].evidence;

  // Still tied (including when no context evidence applies to any
  // candidate) — fall back to the original group priority order.
  for (const name of TOPIC_PRIORITY) {
    const found = topByContext.find((s) => s.evidence.value === name);
    if (found) return found.evidence;
  }
  return topByCore[0].evidence;
}

function updateTopic(text: string, state: UnderstandingState): string | undefined {
  if (state.topic) return state.topic;

  const candidates = collectTopicEvidence(text);
  const resolved = resolveTopic(candidates);
  devLog("TOPIC RESOLVER:", { candidates, resolved });
  if (resolved) return resolved.value;

  if (has(text, ["미래", "앞으로"])) return "미래";

  return state.topic;
}
function extractConcreteTarget(text: string): string | undefined {
  const cleaned = text
    .replace(/[.!?。！？]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const patterns = [
    /^(.+?)(?:의\s*)?장면(?:이|은|는|을|를)?/,
    /^(.+?)(?:의\s*)?기억(?:이|은|는|을|를)?/,
    /^(.+?)(?:이|가)\s*(?:선명하게|먼저|자꾸)\s*떠오/,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    const candidate = match?.[1]?.trim();

    if (
      candidate &&
      candidate.length >= 2 &&
      !["그", "이", "저", "어떤", "하나의"].includes(candidate)
    ) {
      return candidate;
    }
  }

  return undefined;
}
function updateTarget(text: string, state: UnderstandingState): string | undefined {
  if (state.target) return state.target;
  const concreteTarget = extractConcreteTarget(text);
  if (concreteTarget) return concreteTarget;
  if (inRelationship(text, "person")) return "사람";
  if (inWork(text, "workload")) return "업무";
  if (inWork(text, "timePressure")) return "시간 압박";
  if (inWork(text, "blockage")) return "막힌 일";
  if (inWork(text, "stress")) return "압박 상황";
  if (
    has(text, [
        "가끔 연락",
        "가끔 연락한다",
        "연락한다",
        "연락이 왔",
        "연락이 온",
        "연락하",
        "종종",
        "이따금",
        "안부"
    ])
) return "이어지고 있는 연결";

if (
    has(text, [
        "알고 있는",
        "아는",
        "알던",
        "지인",
        "친구",
        "친구이다",
        "친구다"
    ])
) return "느슨한 연결";
  if (isWorkSignal(text)) return "업무 상황";
 
  if (isHealthSignal(text)) return "몸 상태";
  if (has(text, ["대화", "말", "이야기"])) return "대화";

  return state.target;
}

/* =========================================================
 * Emotion resolver — Evidence-based candidate collection.
 *
 * Same principle as the topic resolver above: every branch that matches
 * becomes a candidate instead of returning on the first one, so no
 * signal is silently discarded. `topicHint` (this turn's just-resolved
 * topic, passed in by updateUnderstanding — never state.topic, which
 * would be a turn stale) is used ONLY to relabel the memory.regret
 * candidate when topic is "관계": topic never filters or picks the
 * winning candidate, it only adjusts what one specific candidate's
 * label means in context — "아프" reads as being let down by someone
 * in a relationship, not wistful regret over a memory.
 *
 * Tie-break priority is the exact order the old if-else-if chain used,
 * so any input that used to match exactly one branch (the large
 * majority) resolves to the identical label as before.
 * ========================================================= */

const EMOTION_PRIORITY: readonly string[] = [
  "그리움", "즐거움", "따뜻함", "아쉬움", "서운함", "부담감",
  "쫓기는 느낌", "막막함", "무거움", "불안", "혼란", "외로움", "편안함",
];

function collectEmotionEvidence(text: string, topicHint?: string): Evidence[] {
  const candidates: Evidence[] = [];
  const push = (value: string, matchedGroup: string) =>
    candidates.push({ value, kind: "inferred", sourceText: text, matchedGroup });

  if (inRelationship(text, "longing")) push("그리움", "relationship.longing");
  if (has(text, ["기쁨", "기쁘", "즐겁", "행복", "만족", "뿌듯", "성취", "완성", "보람"]))
    push("즐거움", "direct.joy");
  if (inRelationship(text, "warmth") || inMemory(text, "positive"))
    push("따뜻함", "relationship.warmth|memory.positive");
  if (inMemory(text, "regret"))
    push(topicHint === "관계" ? "서운함" : "아쉬움", "memory.regret");
  if (inWork(text, "stress")) push("부담감", "work.stress");
  if (inWork(text, "timePressure")) push("쫓기는 느낌", "work.timePressure");
  if (inWork(text, "blockage")) push("막막함", "work.blockage");
  if (has(text, ["우울", "가라앉", "무겁"])) push("무거움", "direct.heavy");
  if (has(text, ["불안", "걱정"])) push("불안", "direct.anxiety");
  if (has(text, ["혼란", "어지럽"])) push("혼란", "direct.confusion");
  if (has(text, ["외롭", "쓸쓸"])) push("외로움", "direct.lonely");
  if (has(text, ["편안", "안도"])) push("편안함", "direct.calm");

  return candidates;
}

function resolveEmotion(candidates: Evidence[]): Evidence | undefined {
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];

  for (const label of EMOTION_PRIORITY) {
    const found = candidates.find((c) => c.value === label);
    if (found) return found;
  }
  return candidates[0];
}

function updateEmotion(text: string, state: UnderstandingState, topicHint?: string): string | undefined {
  // lock 아님: 이번 입력에 감정 신호가 있으면 최신 값으로 덮어쓴다.
  // 신호가 없으면 기존 값을 보존한다(coverage 되돌림 방지).
  const candidates = collectEmotionEvidence(text, topicHint);
  const resolved = resolveEmotion(candidates);
  devLog("EMOTION RESOLVER:", { candidates, resolved, topicHint });
  return resolved?.value ?? state.emotion;
}

function updateRelationship(text: string, state: UnderstandingState): string | undefined {
 

  if (inRelationship(text, "separation")) return "끊어진 연결";
  if (inRelationship(text, "longing")) return "남아 있는 연결";
  if (inRelationship(text, "warmth")) return "따뜻했던 연결";
 

    if (
        has(text, [
            "가끔",
            "가끔 연락",
            "연락한다",
            "연락이 왔",
            "연락이 온",
            "연락하",
            "종종",
            "이따금",
            "안부"
        ])
    ) return "이어지고 있는 연결";

    if (
        has(text, [
            "아는",
            "알고 있는",
            "알던",
            "지인",
            "친구",
            "친구이다",
            "친구다",
            "만났던 친구",
            "옛날",
            "예전",
            "예전에",
            "오래전",
            "오랜 친구"
        ])
    ) return "느슨한 연결";

if (isWorkSignal(text)) return "부담을 주는 대상";
 

  return state.relationship;
}

function updatePresentState(text: string, state: UnderstandingState): string | undefined {
 

  if (inRelationship(text, "separation")) return "현재는 멀어진 상태";
  if (inRelationship(text, "longing")) return "아직 남아 있는 감정";
  if (inWork(text, "blockage")) return "일이 막힌 상태";
  if (inWork(text, "timePressure")) return "시간에 쫓기는 상태";
  if (inWork(text, "stress")) return "압박이 지속되는 상태";
  if (inWork(text, "workload")) return "부담이 누적된 상태";
  // isHealthSignal fallback removed: it fired on the same turn as the
  // topic classification itself (any fatigue/pain keyword), pre-filling
  // presentState with a generic placeholder before the user ever
  // described their actual current state — this skipped the natural
  // "how are you right now" follow-up question entirely.
  if (has(text, ["지금도", "아직", "남아", "함께", "즐거웠던", "시간", "추억", "보고싶", "보고 싶", "그립"]))
  return "현재에도 따뜻하게 남아 있음";
  if (has(text, ["모르다", "잘 모르다", "어디에 있는지"])) return "불분명한 상태";
  if (has(text, ["혼란", "뒤엉", "복잡"])) return "혼란스러운 상태";

  return state.presentState;
}

function updateWish(text: string, state: UnderstandingState): string | undefined {
  if (state.wish) return state.wish;

  if (
    has(text, [
      "싶다",
      "싶어",
      "원한다",
      "바란다",
      "희망",
      "원했",
      "원하고",
      "되고싶",
      "되고 싶",
      "하고싶",
      "하고 싶",
    ])
  ) {
    return text;
  }
  if (has(text, ["그리움", "그립", "보고싶", "보고 싶"]))
  return "다시 만나고 싶음";
  return state.wish;
}

function updateMeaning(text: string, state: UnderstandingState): string | undefined {
  if (state.meaning) return state.meaning;

  if (
    has(text, [
      "의미",
      "남겼",
      "남긴",
      "배웠",
      "깨달",
      "후회",
      "소중",
      "교훈",
    ])
  ) {
    return text;
  }
  if (has(text, ["그리움", "그립", "보고싶", "보고 싶"]))
  return "소중한 관계에 대한 그리움";
  return state.meaning;
}

function updateMemoryTone(
  text: string,
  state: UnderstandingState,
): "positive" | "negative" | "mixed" | undefined {
  if (state.memoryTone) return state.memoryTone;

  const positive =
    inMemory(text, "positive") || inRelationship(text, "warmth");
  const negative =
    inMemory(text, "regret") ||
    inWork(text, "stress") ||
    inWork(text, "blockage") ||
    has(text, ["우울", "무겁", "불안", "외롭"]);

  if (positive && negative) return "mixed";
  if (positive) return "positive";
  if (negative) return "negative";

  return state.memoryTone;
}
 export function hasEnoughDetail(value?: string): boolean {
  if (!value) return false;

  const text = value.trim();

  if (text.length < 2) return false;

  const weakWords = [
    "모름",
    "모르겠다",
    "글쎄",
    // "잘" removed: as a bare substring it matched inside concrete,
    // detailed sentences ("서비스 오픈이 잘된다", "일이 잘 풀린다"), flagging
    // them as weak/vague. The hedge phrase it was meant to catch ("잘
    // 모르겠다") is still caught via "모르겠다" above.
    "그냥",
    "둘다",
    "둘 다",
    "비슷",
    "같다",
  ];

  return !weakWords.some((word) => text.includes(word));
}
function normalizeProbedAnswer(slot: Slot, value: string): string {
 
  const text = value.trim();

  if (slot === "wish") {
    const cleaned = text
      .replace(/^그리고\s*마음은\s*/, "")
      .replace(/^마음은\s*/, "")
      .replace(
        /(?:이라는|라는)\s*바람(?:으로|을)?(?:\s*자연스럽게)?\s*(?:이어지고|향하고|움직이고)\s*있습니다[.!]?$/,
        "",
      )
      .replace(/싶다는$/, "싶다")
      .trim();

    return cleaned || text;
  }

  return text;
}
function extractSemanticValue(slot: Slot, text: string): string {
  let value = normalizeProbedAnswer(slot, text);
if (slot === "emotion") {
  value = value
    .replace(/^그 장면과 함께\s*/, "")
    .replace(/^그 기억과 함께\s*/, "")
    .replace(/^함께\s*/, "")
    .replace(/감정이 있습니다$/, "")
    .replace(/감정입니다$/, "")
    .replace(/감정$/, "")
    .trim();
}

if (slot === "meaning") {
  value = value
    .replace(/이기 때문이다$/, "")
    .replace(/때문이다$/, "")
    .replace(/때문입니다$/, "")
    .trim();
}

if (slot === "wish") {
  value = value
    .replace(/^마음은\s*/, "")
    .replace(/^지금\s*/, "")
    .trim();
}
  value = value
    .replace(/입니다$/g, "")
    .replace(/이다$/g, "")
    .replace(/이에요$/g, "")
    .replace(/예요$/g, "")
    .replace(/때문이다$/g, "")
    .replace(/때문입니다$/g, "")
    .replace(/라고 생각한다$/g, "")
    .replace(/라고 생각합니다$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return value || text.trim();
}
export function updateUnderstanding(
  prev: UnderstandingState | undefined,
  answer: string,
  lastProbedSlot?: Slot,
): UnderstandingUpdate {
  const state = prev ?? {};
  const text = (answer ?? "").trim();

   const probedValue =
  lastProbedSlot && hasEnoughDetail(text)
    ? extractSemanticValue(lastProbedSlot, text)
    : undefined;


  const probedFor = (slot: Slot): string | undefined => {
  if (lastProbedSlot !== slot) return undefined;

  return probedValue ?? text.trim();
};
  // Resolved once so updateEmotion can use *this turn's* topic as a
  // tie-break hint (see its doc comment) — state.topic would be a turn
  // stale on the very turn topic is first classified.
  const resolvedTopic = updateTopic(text, state);
  const next: UnderstandingState = {
    topic: resolvedTopic,

    target:
  probedFor("target") ??
  (state.target ?? updateTarget(text, state)),

    emotion:
  probedFor("emotion") ??
  (state.emotion ?? updateEmotion(text, state, resolvedTopic)),

    relationship:
  probedFor("relationship") ??
  (state.relationship ?? updateRelationship(text, state)),

   presentState:
  probedFor("presentState") ??
  (state.presentState ?? updatePresentState(text, state)),

   meaning:
  probedFor("meaning") ??
  (state.meaning ?? updateMeaning(text, state)),

   wish:
  probedFor("wish") ??
  (state.wish ?? updateWish(text, state)),

    memoryTone: updateMemoryTone(text, state),
  };

const coverage: UnderstandingCoverage = {
  topic: Boolean(next.topic),
  target: Boolean(next.target),
  emotion: Boolean(next.emotion),
  relationship: Boolean(next.relationship),
  presentState: Boolean(next.presentState),
  meaning: Boolean(next.meaning),
  wish: Boolean(next.wish),
};

devLog("===== HRI Understanding =====");
devLog("INPUT :", text);
devLog("NEXT  :", next);
devLog("COVER :", coverage);
devLog("=============================");
  return { next, coverage };
}
export const MIN_OBSERVATION_TURNS = 5;
export const COVERAGE_THRESHOLD = 5;

export function coverageDetailScore(next: UnderstandingState): number {
  return [
    hasEnoughDetail(next.topic),
    hasEnoughDetail(next.target),
    hasEnoughDetail(next.emotion),
    hasEnoughDetail(next.relationship),
    hasEnoughDetail(next.presentState),
    hasEnoughDetail(next.meaning),
    hasEnoughDetail(next.wish),
  ].filter(Boolean).length;
}

export function shouldObserve(
    next: UnderstandingState,
    coverage: UnderstandingCoverage,
    turnCount: number,
): boolean {
  return (
    turnCount >= MIN_OBSERVATION_TURNS &&
    coverageDetailScore(next) >= COVERAGE_THRESHOLD
  );
}
