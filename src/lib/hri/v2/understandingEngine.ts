import type { Slot } from "./types.v2";
import { devLog } from "../../devLog";
import type { Evidence, EvidenceKind } from "./evidence";
import {
  computeSufficient,
  mergeUnderstandingKnowledge,
  type UnderstandingKnowledge,
} from "./informationGap";
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
  /**
   * Additive, Sprint04 — this turn's provenance evidence for whichever
   * slots got fresh evidence during this call (see informationGap.ts's
   * scope note). Not consumed anywhere yet: existing callers (e.g.
   * controller.ts) can destructure only `next`/`coverage` and see zero
   * behavior change.
   */
  knowledge: UnderstandingKnowledge;
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

function matchedWords(text: string, words: readonly string[]): string[] {
  return words.filter((word) => text.includes(word));
}

type ScoredTopicEvidence = {
  evidence: Evidence;
  coreScore: number;
  contextScore: number;
};

function collectTopicEvidence(text: string): ScoredTopicEvidence[] {
  const results: ScoredTopicEvidence[] = [];

  for (const name of TOPIC_PRIORITY) {
    const coreTerms = matchedWords(text, TOPIC_GROUP_WORDS[name]);
    if (coreTerms.length === 0) continue;

    const contextTerms =
      name === "기억"
        ? matchedWords(text, SEMANTIC_GROUPS.memory.pastContext)
        : name === "몸 상태"
          ? matchedWords(text, SEMANTIC_GROUPS.health.bodyContext)
          : [];

    results.push({
      evidence: {
        value: name,
        kind: "inferred",
        sourceText: text,
        matchedGroup: name,
        matchedTerms: coreTerms,
        // Sprint05: preserve the actual core/context words that decided
        // this candidate (Sprint04 CASE D found this detail was lost —
        // only the winning topic name survived to Evidence). Undefined
        // rather than [] when empty, so callers can tell "no context
        // evidence applied" apart from "context evidence was checked
        // and empty" without a separate boolean.
        contextTerms: contextTerms.length > 0 ? contextTerms : undefined,
      },
      coreScore: coreTerms.length,
      contextScore: contextTerms.length,
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
/* =========================================================
 * Slot evidence candidates — Sprint04 Knowledge Foundation.
 *
 * Each classifyXCandidate() mirrors its sibling updateX() function's
 * branch order exactly (same conditions, same returned strings) but
 * also reports *why* — the classification that updateUnderstanding()
 * uses to build UnderstandingKnowledge (informationGap.ts). updateX()
 * now derives its value from the same classifier instead of
 * duplicating the branch logic, so there is a single source of truth
 * and no risk of the value and its evidence drifting apart.
 *
 * kind here reflects only the branch's own on-topic/cross-domain
 * nature ("inferred" for a signal genuinely about this slot's concept,
 * "placeholder" for a generic representative label — most visibly
 * target's branches, which are ALL placeholder except the one literal
 * extraction, since nothing but a real extracted phrase can represent
 * a concrete target). Whether the *final* recorded kind becomes
 * "sideEffect" is decided by updateUnderstanding() by comparing
 * lastProbedSlot against the slot being filled — this file has no
 * access to lastProbedSlot and never assigns "sideEffect" itself.
 * ========================================================= */
type SlotEvidenceCandidate = {
  value: string;
  kind: EvidenceKind;
  matchedGroup: string;
  isLiteral: boolean;
};

function classifyTargetCandidate(text: string): SlotEvidenceCandidate | undefined {
  const concreteTarget = extractConcreteTarget(text);
  if (concreteTarget)
    return { value: concreteTarget, kind: "inferred", matchedGroup: "pattern.concreteTarget", isLiteral: true };

  // Every branch below is a generic representative label, never the
  // user's own words — target's whole purpose is "the concrete
  // referent", so anything short of a real extracted phrase is a
  // placeholder standing in for one, not a genuine on-topic inference.
  if (inRelationship(text, "person"))
    return { value: "사람", kind: "placeholder", matchedGroup: "relationship.person", isLiteral: false };
  if (inWork(text, "workload"))
    return { value: "업무", kind: "placeholder", matchedGroup: "work.workload", isLiteral: false };
  if (inWork(text, "timePressure"))
    return { value: "시간 압박", kind: "placeholder", matchedGroup: "work.timePressure", isLiteral: false };
  if (inWork(text, "blockage"))
    return { value: "막힌 일", kind: "placeholder", matchedGroup: "work.blockage", isLiteral: false };
  if (inWork(text, "stress"))
    return { value: "압박 상황", kind: "placeholder", matchedGroup: "work.stress", isLiteral: false };
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
  )
    return { value: "이어지고 있는 연결", kind: "placeholder", matchedGroup: "direct.frequentContact", isLiteral: false };

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
  )
    return { value: "느슨한 연결", kind: "placeholder", matchedGroup: "direct.acquaintance", isLiteral: false };
  if (isWorkSignal(text))
    return { value: "업무 상황", kind: "placeholder", matchedGroup: "work.*", isLiteral: false };
  if (isHealthSignal(text))
    return { value: "몸 상태", kind: "placeholder", matchedGroup: "health.*", isLiteral: false };
  if (has(text, ["대화", "말", "이야기"]))
    return { value: "대화", kind: "placeholder", matchedGroup: "direct.conversation", isLiteral: false };

  return undefined;
}

function updateTarget(text: string, state: UnderstandingState): string | undefined {
  if (state.target) return state.target;
  return classifyTargetCandidate(text)?.value ?? state.target;
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

function classifyRelationshipCandidate(text: string): SlotEvidenceCandidate | undefined {
  // separation/longing/warmth/frequent-contact/acquaintance are all
  // genuinely on-topic for "relationship" (they describe the nature or
  // frequency of the connection itself), so they're inferred, not
  // placeholder, even though the stored label is synthesized rather
  // than the user's literal words.
  if (inRelationship(text, "separation"))
    return { value: "끊어진 연결", kind: "inferred", matchedGroup: "relationship.separation", isLiteral: false };
  if (inRelationship(text, "longing"))
    return { value: "남아 있는 연결", kind: "inferred", matchedGroup: "relationship.longing", isLiteral: false };
  if (inRelationship(text, "warmth"))
    return { value: "따뜻했던 연결", kind: "inferred", matchedGroup: "relationship.warmth", isLiteral: false };

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
  )
    return { value: "이어지고 있는 연결", kind: "inferred", matchedGroup: "direct.frequentContact", isLiteral: false };

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
  )
    return { value: "느슨한 연결", kind: "inferred", matchedGroup: "direct.acquaintance", isLiteral: false };

  // Cross-domain: a work-pressure signal has nothing to do with
  // relationship in the interpersonal sense — this is a genuine
  // placeholder, not a real inference about "relationship".
  if (isWorkSignal(text))
    return { value: "부담을 주는 대상", kind: "placeholder", matchedGroup: "work.*", isLiteral: false };

  return undefined;
}

function updateRelationship(text: string, state: UnderstandingState): string | undefined {
  return classifyRelationshipCandidate(text)?.value ?? state.relationship;
}

function classifyPresentStateCandidate(text: string): SlotEvidenceCandidate | undefined {
  // presentState has no inherent domain of its own (unlike relationship,
  // which is specifically about interpersonal connection) — "what is
  // the current state of things" is meaningfully answered by a signal
  // from any domain, so every branch here is inferred, not placeholder.
  if (inRelationship(text, "separation"))
    return { value: "현재는 멀어진 상태", kind: "inferred", matchedGroup: "relationship.separation", isLiteral: false };
  if (inRelationship(text, "longing"))
    return { value: "아직 남아 있는 감정", kind: "inferred", matchedGroup: "relationship.longing", isLiteral: false };
  if (inWork(text, "blockage"))
    return { value: "일이 막힌 상태", kind: "inferred", matchedGroup: "work.blockage", isLiteral: false };
  if (inWork(text, "timePressure"))
    return { value: "시간에 쫓기는 상태", kind: "inferred", matchedGroup: "work.timePressure", isLiteral: false };
  if (inWork(text, "stress"))
    return { value: "압박이 지속되는 상태", kind: "inferred", matchedGroup: "work.stress", isLiteral: false };
  if (inWork(text, "workload"))
    return { value: "부담이 누적된 상태", kind: "inferred", matchedGroup: "work.workload", isLiteral: false };
  // isHealthSignal fallback removed: it fired on the same turn as the
  // topic classification itself (any fatigue/pain keyword), pre-filling
  // presentState with a generic placeholder before the user ever
  // described their actual current state — this skipped the natural
  // "how are you right now" follow-up question entirely.
  if (has(text, ["지금도", "아직", "남아", "함께", "즐거웠던", "시간", "추억", "보고싶", "보고 싶", "그립"]))
    return { value: "현재에도 따뜻하게 남아 있음", kind: "inferred", matchedGroup: "direct.stillPresent", isLiteral: false };
  if (has(text, ["모르다", "잘 모르다", "어디에 있는지"]))
    return { value: "불분명한 상태", kind: "inferred", matchedGroup: "direct.unknown", isLiteral: false };
  if (has(text, ["혼란", "뒤엉", "복잡"]))
    return { value: "혼란스러운 상태", kind: "inferred", matchedGroup: "direct.confusion", isLiteral: false };

  return undefined;
}

function updatePresentState(text: string, state: UnderstandingState): string | undefined {
  return classifyPresentStateCandidate(text)?.value ?? state.presentState;
}

function classifyWishCandidate(text: string): SlotEvidenceCandidate | undefined {
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
    // The keyword trigger is broad and the attribution to "wish"
    // specifically is inferred, but the stored value is the user's own
    // sentence verbatim — a literal value reached via an inferred path.
    return { value: text, kind: "inferred", matchedGroup: "direct.wishKeyword", isLiteral: true };
  }
  if (has(text, ["그리움", "그립", "보고싶", "보고 싶"]))
    return { value: "다시 만나고 싶음", kind: "inferred", matchedGroup: "relationship.longing", isLiteral: false };
  return undefined;
}

function updateWish(text: string, state: UnderstandingState): string | undefined {
  if (state.wish) return state.wish;
  return classifyWishCandidate(text)?.value ?? state.wish;
}

function classifyMeaningCandidate(text: string): SlotEvidenceCandidate | undefined {
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
    return { value: text, kind: "inferred", matchedGroup: "direct.meaningKeyword", isLiteral: true };
  }
  if (has(text, ["그리움", "그립", "보고싶", "보고 싶"]))
    return { value: "소중한 관계에 대한 그리움", kind: "inferred", matchedGroup: "relationship.longing", isLiteral: false };
  return undefined;
}

function updateMeaning(text: string, state: UnderstandingState): string | undefined {
  if (state.meaning) return state.meaning;
  return classifyMeaningCandidate(text)?.value ?? state.meaning;
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
  prevKnowledge?: UnderstandingKnowledge,
  turnCount?: number,
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

  const freshKnowledge = buildUnderstandingKnowledge({
    text,
    lastProbedSlot,
    state,
    next,
    resolvedTopic,
    turn: turnCount,
  });

  // Sprint05: turn-local evidence -> persistent knowledge. Fresh
  // evidence (this turn) always wins for a slot; otherwise the prior
  // turn's knowledge carries forward only if it still explains the
  // current value (mergeUnderstandingKnowledge's stale-provenance
  // guard) — see informationGap.ts's doc comment.
  const knowledge = mergeUnderstandingKnowledge(prevKnowledge, freshKnowledge, next);

devLog("===== HRI Understanding =====");
devLog("INPUT :", text);
devLog("NEXT  :", next);
devLog("COVER :", coverage);
devLog("=============================");
  return { next, coverage, knowledge };
}

/* =========================================================
 * Knowledge construction — Sprint04 Knowledge Foundation.
 *
 * Purely additive: reads next/state/lastProbedSlot and produces a
 * UnderstandingKnowledge snapshot of THIS TURN's evidence only (see
 * informationGap.ts's scope note — no cross-turn persistence yet).
 * Never influences `next`/`coverage`, and nothing downstream
 * (decideNextSlot / planObservation / Reflection readiness) reads it
 * this Sprint.
 * ========================================================= */
function recordSlotKnowledge(
  knowledge: UnderstandingKnowledge,
  slot: Slot,
  text: string,
  lastProbedSlot: Slot | undefined,
  finalValue: string | undefined,
  stateValue: string | undefined,
  classify: (text: string) => SlotEvidenceCandidate | undefined,
  turn: number | undefined,
): void {
  if (!finalValue) return;

  if (lastProbedSlot === slot) {
    const evidence: Evidence = {
      value: finalValue,
      kind: "explicit",
      sourceText: text,
      matchedGroup: "probed.directAnswer",
      turn,
    };
    knowledge[slot] = {
      value: finalValue,
      evidence,
      isLiteral: true,
      sufficient: computeSufficient(finalValue, evidence, hasEnoughDetail),
    };
    return;
  }

  // Value carried over unchanged from a prior turn (call site
  // short-circuited before updateX() ever ran) — no fresh evidence
  // this turn, so no entry (see informationGap.ts's scope note).
  if (stateValue) return;

  const candidate = classify(text);
  if (!candidate) return;

  // A slot was actively probed this turn (lastProbedSlot is set) but
  // it wasn't THIS slot — whatever filled this slot did so as a
  // byproduct of answering a different question.
  const kind: EvidenceKind = lastProbedSlot ? "sideEffect" : candidate.kind;
  const evidence: Evidence = {
    value: candidate.value,
    kind,
    sourceText: text,
    matchedGroup: candidate.matchedGroup,
    turn,
  };
  knowledge[slot] = {
    value: candidate.value,
    evidence,
    isLiteral: candidate.isLiteral,
    sufficient: computeSufficient(candidate.value, evidence, hasEnoughDetail),
  };
}

function buildUnderstandingKnowledge(args: {
  text: string;
  lastProbedSlot: Slot | undefined;
  state: UnderstandingState;
  next: UnderstandingState;
  resolvedTopic: string | undefined;
  turn: number | undefined;
}): UnderstandingKnowledge {
  const { text, lastProbedSlot, state, next, resolvedTopic, turn } = args;
  const knowledge: UnderstandingKnowledge = {};

  // topic: never explicit (doesn't go through probedFor). Only ever has
  // fresh evidence on the turn it's first classified (state.topic was
  // empty going in) — recomputing collectTopicEvidence/resolveTopic
  // here is cheap and keeps updateTopic()'s own signature untouched.
  if (next.topic && !state.topic) {
    const topicCandidates = collectTopicEvidence(text);
    const resolved = resolveTopic(topicCandidates);
    if (resolved) {
      const evidence: Evidence = { ...resolved, turn };
      knowledge.topic = {
        value: resolved.value,
        evidence,
        isLiteral: false,
        sufficient: computeSufficient(resolved.value, evidence, hasEnoughDetail),
      };
    } else if (next.topic === "미래") {
      const evidence: Evidence = { value: "미래", kind: "inferred", sourceText: text, matchedGroup: "direct.future", turn };
      knowledge.topic = {
        value: "미래",
        evidence,
        isLiteral: false,
        sufficient: computeSufficient("미래", evidence, hasEnoughDetail),
      };
    }
  }

  // emotion: has its own Evidence-producing resolver (Sprint02), so it
  // gets the same probed/carried/fresh treatment as the other slots but
  // sources its "fresh" branch from collectEmotionEvidence/resolveEmotion
  // instead of a classifyXCandidate() function.
  if (next.emotion) {
    if (lastProbedSlot === "emotion") {
      const evidence: Evidence = {
        value: next.emotion,
        kind: "explicit",
        sourceText: text,
        matchedGroup: "probed.directAnswer",
        turn,
      };
      knowledge.emotion = {
        value: next.emotion,
        evidence,
        isLiteral: true,
        sufficient: computeSufficient(next.emotion, evidence, hasEnoughDetail),
      };
    } else if (!state.emotion) {
      const emotionCandidates = collectEmotionEvidence(text, resolvedTopic);
      const resolved = resolveEmotion(emotionCandidates);
      if (resolved) {
        const kind: EvidenceKind = lastProbedSlot ? "sideEffect" : resolved.kind;
        const evidence: Evidence = { ...resolved, kind, turn };
        knowledge.emotion = {
          value: resolved.value,
          evidence,
          isLiteral: false,
          sufficient: computeSufficient(resolved.value, evidence, hasEnoughDetail),
        };
      }
    }
  }

  recordSlotKnowledge(knowledge, "target", text, lastProbedSlot, next.target, state.target, classifyTargetCandidate, turn);
  recordSlotKnowledge(knowledge, "relationship", text, lastProbedSlot, next.relationship, state.relationship, classifyRelationshipCandidate, turn);
  recordSlotKnowledge(knowledge, "presentState", text, lastProbedSlot, next.presentState, state.presentState, classifyPresentStateCandidate, turn);
  recordSlotKnowledge(knowledge, "meaning", text, lastProbedSlot, next.meaning, state.meaning, classifyMeaningCandidate, turn);
  recordSlotKnowledge(knowledge, "wish", text, lastProbedSlot, next.wish, state.wish, classifyWishCandidate, turn);

  return knowledge;
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
