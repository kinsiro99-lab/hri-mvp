import type { HriEvent, RhythmSignal, RhythmVectorScores } from "./types";
import { getUserInputTexts } from "./events";
import { detectContextAnchors } from "./contextAnchors";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function score(text: string, words: string[]) {
  if (!text) return 0;
  const hits = words.reduce((count, word) => count + (text.includes(word) ? 1 : 0), 0);
  return Math.min(1, hits / 2);
}

function lexicalOverlap(a: string, b: string) {
  const aTokens = new Set(a.split(/\s+/).filter((token) => token.length > 1));
  const bTokens = b.split(/\s+/).filter((token) => token.length > 1);
  if (aTokens.size === 0 || bTokens.length === 0) return 0;
  const overlap = bTokens.filter((token) => aTokens.has(token)).length;
  return Math.min(1, overlap / Math.max(1, bTokens.length));
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

export function detectRhythm(inputText: string, previousEvents: HriEvent[]): RhythmSignal {
  const text = inputText.trim().toLowerCase();
  const previousInputs = getUserInputTexts(previousEvents);
  const lastInput = previousInputs.at(-1) ?? "";
  const anchor = detectContextAnchors(previousEvents, text).anchor;

  const vectors: RhythmVectorScores = {
    collapse: score(text, ["무겁", "가라앉", "힘들", "지쳤", "피곤", "버겁", "heavy", "tired"]),
    pressure: score(text, ["압박", "쫓기", "해야", "불안", "긴장", "밀려", "부담", "촉박", "준비", "일정", "베타", "런칭", "출시", "서비스", "pressure", "anxious"]),
    fragmentation: score(text, ["흩어", "정리", "모르", "복잡", "분산", "깨져", "fragment", "scattered"]),
    looping: score(text, ["계속", "반복", "또", "자꾸", "돌아", "걱정", "loop", "again"]),
    avoidance: score(text, ["피하", "미루", "보기 싫", "도망", "avoid", "escape"]),
    numbness: score(text, ["무감", "아무", "모르겠", "멍", "공허", "numb", "empty"]),
    selfBlame: score(text, ["내 탓", "못해서", "한심", "잘못", "자책", "부족", "fault", "blame"]),
    inwardMotion: score(text, ["안으로", "속", "내 안", "가라앉", "숨", "inside", "inward"]),
    outwardMotion: score(text, ["밖으로", "화", "밀어", "말하고", "폭발", "outside", "outward"]),
  };

  if (anchor === "launchPressure") {
    vectors.pressure = clamp01(vectors.pressure + 0.42);
    vectors.looping = clamp01(vectors.looping + 0.12);
    vectors.fragmentation = clamp01(vectors.fragmentation + 0.1);
  }

  if (anchor === "deadlinePressure" || anchor === "delay") {
    vectors.pressure = clamp01(vectors.pressure + 0.35);
    vectors.looping = clamp01(vectors.looping + 0.15);
  }

  if (anchor === "workload") {
    vectors.pressure = clamp01(vectors.pressure + 0.18);
    vectors.fragmentation = clamp01(vectors.fragmentation + 0.14);
  }

  if (anchor === "fatigue") {
    vectors.collapse = clamp01(vectors.collapse + 0.25);
  }

  const emotionalDensity = Math.max(
    vectors.collapse,
    vectors.pressure,
    vectors.fragmentation,
    vectors.selfBlame,
    score(text, ["너무", "전부", "항상", "아무것도", "모든"])
  );

  const exhaustion = Math.max(vectors.collapse, score(text, ["쉬고", "잠", "지침", "소진", "burnout"]));
  const openness = includesAny(text, ["기쁘", "좋", "즐겁", "순조", "편안"])
    ? 0.7
    : Math.max(0.15, score(text, ["같", "어쩌면", "느낌", "생각", "아마", "maybe", "seems"]));
  const repetition = Math.max(vectors.looping, lexicalOverlap(lastInput.toLowerCase(), text));

  return { vectors, emotionalDensity, openness, exhaustion, repetition };
}
