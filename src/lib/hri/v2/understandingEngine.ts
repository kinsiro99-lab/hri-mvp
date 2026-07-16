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
      "정",
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
    inWork(text, "blockage") ||
    inWork(text, "deprivation")
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

function updateTopic(text: string, state: UnderstandingState): string | undefined {
  if (state.topic) return state.topic;

  if (isWorkSignal(text)) return "업무 압박";
  if (isRelationshipSignal(text)) return "관계";
  if (isMemorySignal(text)) return "기억";
  if (isHealthSignal(text)) return "몸 상태";
  if (has(text, ["미래", "앞으로"])) return "미래";

  return state.topic;
}

function updateTarget(text: string, state: UnderstandingState): string | undefined {
  if (state.target) return state.target;

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
  if (inMemory(text, "scene")) return "장면";
  if (isHealthSignal(text)) return "몸 상태";
  if (has(text, ["대화", "말", "이야기"])) return "대화";

  return state.target;
}

function updateEmotion(text: string, state: UnderstandingState): string | undefined {
  if (state.emotion) return state.emotion;

  if (inRelationship(text, "longing")) return "그리움";
  if (inRelationship(text, "warmth") || inMemory(text, "positive")) return "따뜻함";
  if (inMemory(text, "regret")) return "아쉬움";
  if (inWork(text, "stress")) return "부담감";
  if (inWork(text, "timePressure")) return "쫓기는 느낌";
  if (inWork(text, "blockage")) return "막막함";
  if (has(text, ["우울", "가라앉", "무겁"])) return "무거움";
  if (has(text, ["불안", "걱정"])) return "불안";
  if (has(text, ["혼란", "어지럽"])) return "혼란";
  if (has(text, ["외롭", "쓸쓸"])) return "외로움";
  if (has(text, ["기쁨", "기쁘", "즐겁", "행복", "만족", "뿌듯", "성취", "완성", "보람"]))
  return "즐거움";

if (has(text, ["편안", "안도"])) return "편안함";

return state.emotion;
}

function updateRelationship(text: string, state: UnderstandingState): string | undefined {
  if (state.relationship) return state.relationship;

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
  if (state.presentState) return state.presentState;

  if (inRelationship(text, "separation")) return "현재는 멀어진 상태";
  if (inRelationship(text, "longing")) return "아직 남아 있는 감정";
  if (inWork(text, "blockage")) return "일이 막힌 상태";
  if (inWork(text, "timePressure")) return "시간에 쫓기는 상태";
  if (inWork(text, "stress")) return "압박이 지속되는 상태";
  if (inWork(text, "workload")) return "부담이 누적된 상태";
  if (isHealthSignal(text)) return "회복이 필요한 상태";
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
function hasEnoughDetail(value?: string): boolean {
  if (!value) return false;

  const text = value.trim();

  if (text.length < 3) return false;

  const weakWords = [
    "모름",
    "모르겠다",
    "글쎄",
    "잘",
    "그냥",
    "둘다",
    "둘 다",
    "비슷",
    "같다",
  ];

  return !weakWords.some((word) => text.includes(word));
}

export function updateUnderstanding(
  prev: UnderstandingState | undefined,
  answer: string,
): UnderstandingUpdate {
  const state = prev ?? {};
  const text = (answer ?? "").trim();

  const next: UnderstandingState = {
    topic: updateTopic(text, state),
    target: updateTarget(text, state),
    emotion: updateEmotion(text, state),
    relationship: updateRelationship(text, state),
    presentState: updatePresentState(text, state),
    meaning: updateMeaning(text, state),
    wish: updateWish(text, state),
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

console.log("===== HRI Understanding =====");
console.log("INPUT :", text);
console.log("NEXT  :", next);
console.log("COVER :", coverage);
console.log("=============================");
  return { next, coverage };     
}
export const MIN_OBSERVATION_TURNS = 5;
export const COVERAGE_THRESHOLD = 5;

export function shouldObserve(
    next: UnderstandingState,
    coverage: UnderstandingCoverage,
    turnCount: number,
): boolean {
  const score = [
    hasEnoughDetail(next.topic),
    hasEnoughDetail(next.target),
    hasEnoughDetail(next.emotion),
    hasEnoughDetail(next.relationship),
    hasEnoughDetail(next.presentState),
    hasEnoughDetail(next.meaning),
    hasEnoughDetail(next.wish),
].filter(Boolean).length;
  return (
    turnCount >= MIN_OBSERVATION_TURNS &&
    score >= COVERAGE_THRESHOLD
  );
}
