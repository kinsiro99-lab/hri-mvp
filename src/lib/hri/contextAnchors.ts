import type { HriEvent } from "./types";

export type HriContextAnchor =
  | "lowSignal"
  | "positive"
  | "reliefWish"
  | "fatigue"
  | "workload"
  | "launchPressure"
  | "deadlinePressure"
  | "uncertainty"
  | "delay"
  | "body"
  | "conflict"
  | "general";

export type ContextTone = "positive" | "mixed" | "pressured" | "neutral";
export type PositiveSignal = "joy" | "calm" | "hope" | "flow" | "relief" | "none";

export type ContextAnchorResult = {
  anchor: HriContextAnchor;
  confidence: number;
  latestInput: string;
  allInputs: string[];
  hits: string[];
  positiveHits: string[];
  pressureHits: string[];
  tone: ContextTone;
  positiveSignal: PositiveSignal;
};

const keywordMap: Record<Exclude<HriContextAnchor, "lowSignal" | "general">, string[]> = {
  positive: [
    "기쁘",
    "기쁜",
    "기쁨",
    "좋",
    "즐겁",
    "즐거",
    "행복",
    "상쾌",
    "개운",
    "희망",
    "희망적",
    "기대",
    "기대감",
    "설레",
    "편안",
    "평온",
    "여유",
    "가볍",
    "순조",
    "풀리",
    "잘되",
    "잘 되",
    "잘돼",
    "잘 돼",
    "안정",
    "괜찮",
    "감사",
    "만족",
    "해냈",
    "된다",
  ],
  reliefWish: [
    "떨어지면 좋",
    "덜어지면 좋",
    "줄어들면 좋",
    "끝나면 좋",
    "해결되면 좋",
    "사라지면 좋",
    "없어지면 좋",
    "해소되면 좋",
    "풀리면 좋",
    "정리되면 좋",
    "마무리되면 좋",
  ],
  fatigue: ["피곤", "지치", "무겁", "힘들", "쉬고", "휴식", "번아웃", "기운", "졸리"],
  workload: ["업무", "작업", "회의", "보고", "프로젝트", "개발", "수정", "빌드"],
  launchPressure: ["베타", "런칭", "출시", "서비스", "공시", "오픈", "개시", "배포", "출범"],
  deadlinePressure: ["일정", "마감", "기한", "촉박", "시간", "준비", "기간", "늦", "밀렸", "지연"],
  uncertainty: ["걱정", "불안", "두렵", "무섭", "모르", "막막", "위험", "부담", "압박"],
  delay: ["밀렸", "늦", "지연", "막힘", "정체", "미뤄", "연기"],
  body: ["몸", "가슴", "머리", "배", "숨", "호흡", "어깨", "목", "심장", "감각"],
  conflict: ["화", "짜증", "분노", "억울", "갈등", "불편", "싫", "상처"],
};

const positiveSignalMap: Record<Exclude<PositiveSignal, "none">, string[]> = {
  joy: ["기쁘", "기쁜", "기쁨", "즐겁", "즐거", "행복", "좋", "상쾌", "개운", "만족"],
  calm: ["편안", "평온", "여유", "안정", "차분", "괜찮"],
  hope: ["희망", "희망적", "기대", "기대감", "설레", "앞으로", "가능"],
  flow: ["순조", "풀리", "잘되", "잘 되", "잘돼", "잘 돼", "해냈", "된다", "진행"],
  relief: ["가볍", "개운", "덜어", "줄어", "해소", "풀렸", "편해"],
};

const negationNearPositive = ["안 좋", "좋지", "못 좋", "잘 안", "잘못", "별로", "아니다", "않다"];
const pressureAnchors: Array<Exclude<HriContextAnchor, "lowSignal" | "positive" | "general">> = [
  "reliefWish",
  "fatigue",
  "workload",
  "launchPressure",
  "deadlinePressure",
  "uncertainty",
  "delay",
  "body",
  "conflict",
];

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function getUserInputTexts(events: HriEvent[] = []): string[] {
  return events
    .filter((event) => event.type === "user_input")
    .map((event) => normalize(event.text ?? ""))
    .filter(Boolean);
}

function isLowSignal(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  if (compact.length < 3) return true;

  const koreanCount = (compact.match(/[가-힣]/g) ?? []).length;
  const alphaCount = (compact.match(/[a-zA-Z]/g) ?? []).length;
  const meaningfulChars = koreanCount + alphaCount;

  if (meaningfulChars < 3) return true;
  if (compact.length >= 5 && koreanCount === 0 && alphaCount / compact.length > 0.8) return true;

  return false;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function hitKeywords(text: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => text.includes(keyword));
}

function positiveIsProbablyNegated(text: string): boolean {
  return negationNearPositive.some((phrase) => text.includes(phrase));
}

function detectPositiveSignal(text: string): PositiveSignal {
  const scores = Object.entries(positiveSignalMap).map(([signal, keywords]) => ({
    signal: signal as Exclude<PositiveSignal, "none">,
    score: hitKeywords(text, keywords).length,
  }));
  const best = scores.sort((a, b) => b.score - a.score)[0];
  return best && best.score > 0 ? best.signal : "none";
}

function baseResult(
  partial: Omit<ContextAnchorResult, "positiveSignal">,
  joined: string,
): ContextAnchorResult {
  return {
    ...partial,
    positiveSignal: detectPositiveSignal(joined),
  };
}

export function extractUserInputs(events: HriEvent[] = []): string[] {
  return getUserInputTexts(events);
}

export function detectContextAnchors(events: HriEvent[] = [], currentText = ""): ContextAnchorResult {
  const eventInputs = getUserInputTexts(events);
  const latestInput = normalize(currentText || eventInputs[eventInputs.length - 1] || "");
  const allInputs = currentText ? [...eventInputs, latestInput].filter(Boolean) : eventInputs;
  const joined = normalize(allInputs.join(" "));

  if (!joined || isLowSignal(latestInput)) {
    return baseResult(
      {
        anchor: "lowSignal",
        confidence: 0.3,
        latestInput,
        allInputs,
        hits: [],
        positiveHits: [],
        pressureHits: [],
        tone: "neutral",
      },
      joined,
    );
  }

  const scored = Object.entries(keywordMap).map(([anchor, keywords]) => {
    const hits = hitKeywords(joined, keywords);
    const latestHits = hitKeywords(latestInput, keywords);
    const positivePenalty = anchor === "positive" && positiveIsProbablyNegated(joined) ? 1.4 : 0;

    return {
      anchor: anchor as Exclude<HriContextAnchor, "lowSignal" | "general">,
      score: Math.max(0, hits.length + latestHits.length * 0.85 - positivePenalty),
      hits: unique([...hits, ...latestHits]),
    };
  });

  const scoreOf = (anchor: Exclude<HriContextAnchor, "lowSignal" | "general">) =>
    scored.find((item) => item.anchor === anchor)?.score ?? 0;
  const hitsOf = (anchor: Exclude<HriContextAnchor, "lowSignal" | "general">) =>
    scored.find((item) => item.anchor === anchor)?.hits ?? [];

  const positiveScore = scoreOf("positive");
  const positiveHits = hitsOf("positive");
  const pressureHits = unique(pressureAnchors.flatMap((anchor) => hitsOf(anchor)));
  const pressureScore = pressureAnchors.reduce((sum, anchor) => sum + scoreOf(anchor), 0);
  const tone: ContextTone =
    positiveScore > 0 && pressureScore > 0
      ? "mixed"
      : positiveScore > 0
        ? "positive"
        : pressureScore > 0
          ? "pressured"
          : "neutral";

  const launch = scoreOf("launchPressure");
  const deadline = scoreOf("deadlinePressure");
  const workload = scoreOf("workload");
  const uncertainty = scoreOf("uncertainty");
  const reliefWish = scoreOf("reliefWish");

  if (reliefWish > 0) {
    const hits = unique([
      ...hitsOf("reliefWish"),
      ...hitsOf("workload"),
      ...hitsOf("deadlinePressure"),
      ...hitsOf("uncertainty"),
    ]);

    return baseResult(
      {
        anchor: "reliefWish",
        confidence: 0.88,
        latestInput,
        allInputs,
        hits,
        positiveHits,
        pressureHits,
        tone: pressureScore > 0 ? "pressured" : tone,
      },
      joined,
    );
  }

  if (launch > 0 && (deadline > 0 || workload > 0 || uncertainty > 0)) {
    const hits = unique([
      ...hitsOf("launchPressure"),
      ...hitsOf("deadlinePressure"),
      ...hitsOf("workload"),
      ...hitsOf("uncertainty"),
      ...positiveHits,
    ]);

    return baseResult(
      {
        anchor: "launchPressure",
        confidence: 0.9,
        latestInput,
        allInputs,
        hits,
        positiveHits,
        pressureHits,
        tone,
      },
      joined,
    );
  }

  const best = scored.sort((a, b) => b.score - a.score)[0];
  if (!best || best.score <= 0) {
    return baseResult(
      {
        anchor: "general",
        confidence: 0.45,
        latestInput,
        allInputs,
        hits: [],
        positiveHits,
        pressureHits,
        tone,
      },
      joined,
    );
  }

  return baseResult(
    {
      anchor: best.anchor,
      confidence: Math.min(0.95, 0.45 + best.score * 0.12),
      latestInput,
      allInputs,
      hits: best.hits,
      positiveHits,
      pressureHits,
      tone,
    },
    joined,
  );
}
