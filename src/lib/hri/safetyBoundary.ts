import type { SafetyResult } from "./types";

const CRISIS_MESSAGE =
  "지금 내용은 조용히 이어가기보다 안전이 먼저인 흐름으로 보여요. 혼자 감당하지 말고, 가까운 사람이나 지역 긴급 지원에 바로 연결해 주세요. 즉각적인 위험이 있다면 현지 응급 번호로 연락해 주세요.";

/**
 * Self-contained crisis markers — unambiguous on their own, no object or
 * context needed to interpret them. Checked first and unconditionally;
 * never affected by the ambiguous-marker/context logic below. Recall for
 * this list must never be reduced.
 */
const SELF_CONTAINED_CRISIS_MARKERS = [
  "죽고 싶",
  "사라지고 싶",
  "자해",
  "살기 싫",
  // Gate 2: "살고 싶지 않다" — a full negated-life-wish phrase, not a bare
  // "살"/"싫" substring (see safetyBoundary audit — those are banned as
  // too broad). Also matches its own longer prefixed variants unchanged
  // ("더 이상 살고 싶지 않다", "이제 살고 싶지 않다") via plain substring
  // inclusion, so no separate marker is needed for those. Does NOT match
  // "이렇게/잘/서울에서 살고 싶다" (no negation present), so no new false
  // positive against Gate 1's safe cases.
  "살고 싶지 않다",
  "suicide",
  "kill myself",
  "self harm",
];

/**
 * Ambiguous markers — meaning depends entirely on the object being acted
 * on ("일을 끝내고 싶다" vs "삶을 끝내고 싶다"). Never auto-safe: only
 * cleared when the current sentence, or (if the sentence has no object at
 * all) recent context, supplies a non-life object. See checkSafetyBoundary.
 */
const AMBIGUOUS_CRISIS_MARKERS = ["끝내고 싶"];

/** If a life/self object co-occurs with an ambiguous marker, it stays
 *  crisis regardless of any task object also present in the same
 *  sentence (e.g. "일도 삶도 다 끝내고 싶다"). */
const LIFE_OBJECT_MARKERS = ["삶", "인생", "목숨", "생명", "모든 것", "모든 걸"];

/** Minimal reuse of domainEngine.ts's "work" domain keywords — only what's
 *  needed to recognize a task/work object clearing an ambiguous marker. */
const WORK_OBJECT_MARKERS = [
  "일", "업무", "회사", "직장", "프로젝트", "회의", "보고", "마감",
  "과제", "작업", "숙제", "출근", "야근",
];

function includesAny(text: string, markers: readonly string[]): boolean {
  return markers.some((marker) => text.includes(marker));
}

/**
 * `recentUserTexts` — the last few prior user inputs this session (caller
 * passes them; not read from any store here). Only consulted when the
 * current sentence has an ambiguous marker AND no object of its own —
 * never for self-contained markers, and never to override a life/self
 * object found in the current sentence. If context doesn't resolve it
 * either, the result stays crisis (safety-conservative default).
 */
export function checkSafetyBoundary(inputText: string, recentUserTexts: string[] = []): SafetyResult {
  const text = inputText.toLowerCase();

  if (includesAny(text, SELF_CONTAINED_CRISIS_MARKERS)) {
    return { safe: false, message: CRISIS_MESSAGE };
  }

  if (includesAny(text, AMBIGUOUS_CRISIS_MARKERS)) {
    if (includesAny(text, LIFE_OBJECT_MARKERS)) {
      return { safe: false, message: CRISIS_MESSAGE };
    }
    if (includesAny(text, WORK_OBJECT_MARKERS)) {
      return { safe: true };
    }

    const recentContext = recentUserTexts.join(" ").toLowerCase();
    if (includesAny(recentContext, WORK_OBJECT_MARKERS)) {
      return { safe: true };
    }

    return { safe: false, message: CRISIS_MESSAGE };
  }

  return { safe: true };
}
