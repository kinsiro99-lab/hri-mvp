import type { SafetyResult } from "./types";
import type { Locale } from "./locale";

/**
 * Multilingual Gate — Japanese. Per Beta Handoff §7/§14: Japanese
 * crisis detection is a SEPARATE, additional marker set — the Korean
 * arrays below are byte-preserved, unmerged, unmodified. Never a
 * generalized/shared list: each locale owns its own literal markers,
 * checked only when that locale is active.
 */
const CRISIS_MESSAGE: Record<Locale, string> = {
  ko: "지금 내용은 조용히 이어가기보다 안전이 먼저인 흐름으로 보여요. 혼자 감당하지 말고, 가까운 사람이나 지역 긴급 지원에 바로 연결해 주세요. 즉각적인 위험이 있다면 현지 응급 번호로 연락해 주세요.",
  ja: "今のお話は、静かに続けるよりも安全を優先すべき内容のように見えます。一人で抱え込まず、身近な人や地域の緊急支援にすぐ連絡してください。今すぐ危険がある場合は、現地の緊急通報番号に連絡してください。",
  // Multilingual Gate — English. Same content/structure as ko/ja, not a
  // literal translation of either.
  en: "What you're sharing sounds like something that calls for safety first, more than a quiet continued conversation. Please don't carry this alone — reach out to someone close to you or a local crisis support line right away. If you are in immediate danger, please contact your local emergency number.",
  // 7-Locale Runtime Output Support Gate — same content/structure as
  // ko/ja/en, not a literal translation of any of them. zh-HK/zh-TW
  // kept near-identical to each other (unlike other locale-keyed prose
  // in this codebase) deliberately: this is the crisis-response message
  // itself, where safety-recall/clarity matters far more than regional
  // stylistic distinctiveness.
  fr: "Ce que vous partagez semble appeler la sécurité avant tout, plutôt qu'une simple continuation de la conversation. Ne portez pas cela seul(e) — contactez dès maintenant un proche ou une ligne d'écoute locale. En cas de danger immédiat, contactez les services d'urgence de votre région.",
  "zh-CN": "你现在分享的内容，似乎比安静地继续对话更需要优先考虑安全。请不要独自承受这些，请立即联系身边信任的人，或当地的紧急支援热线。如果有即时危险，请联系当地的紧急电话。",
  "zh-HK": "你現在分享的內容，似乎比安靜地繼續對話更需要優先考慮安全。請不要獨自承受這些，請立即聯絡身邊信任的人，或本地的緊急支援熱線。如果有即時危險，請聯絡當地的緊急電話。",
  "zh-TW": "你現在分享的內容，似乎比安靜地繼續對話更需要優先考慮安全。請不要獨自承受這些，請立即聯絡身邊信任的人，或當地的緊急支援專線。如果有立即危險，請聯絡當地的緊急電話。",
};

/**
 * Self-contained crisis markers — unambiguous on their own, no object or
 * context needed to interpret them. Checked first and unconditionally;
 * never affected by the ambiguous-marker/context logic below. Recall for
 * this list must never be reduced.
 */
const SELF_CONTAINED_CRISIS_MARKERS: Record<Locale, string[]> = {
  ko: [
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
  ],
  // Direct Japanese equivalents of the Korean set above, plus the same
  // English terms kept for parity (a Japanese-locale user may still type
  // an English crisis phrase). "生きていたくない" is a full negated-life-
  // wish phrase (same "not a bare stem" discipline as Korean's "살고
  // 싶지 않다") — chosen over a bare "生き"/"嫌" substring to avoid the
  // same false-positive class Gate 2 audited for Korean.
  ja: [
    "死にたい",
    "消えたい",
    "自傷",
    "自殺したい",
    "死んでしまいたい",
    "生きていたくない",
    "生きたくない",
    "suicide",
    "kill myself",
    "self harm",
  ],
  // Multilingual Gate — English. §11 audit: "suicide"/"kill myself"/
  // "self harm" already existed as English-loanword coverage inside the
  // ko/ja arrays above — this array is the dedicated home for the
  // locale:"en" case (each locale reads only its own array, never a
  // merged one, per the established per-locale-array discipline), not
  // a duplicate of those; same semantic categories as ko/ja (want to
  // die, want to disappear, self-harm, a full negated-life-wish phrase
  // rather than a bare stem — same false-positive-avoidance discipline
  // as ko's "살고 싶지 않다"/ja's "生きていたくない").
  en: [
    "want to die",
    "wish i was dead",
    "wish i were dead",
    "want to disappear",
    "self harm",
    "self-harm",
    "kill myself",
    "end my life",
    "don't want to live anymore",
    "do not want to live anymore",
    "suicide",
  ],
  // 7-Locale Runtime Output Support Gate — same categories as ko/ja/en
  // (want to die, want to disappear, self-harm, a full negated-life-wish
  // phrase rather than a bare stem), plus English-loanword coverage kept
  // for parity, same reasoning as en's own array above. zh-HK/zh-TW kept
  // deliberately near-identical (recall priority for crisis detection —
  // see CRISIS_MESSAGE's own note), unlike other locale-keyed lists.
  fr: [
    "je veux mourir", "j'ai envie de mourir", "je voudrais mourir",
    "je veux disparaître", "je veux disparaitre",
    "automutilation",
    "je ne veux plus vivre", "je ne veux pas vivre",
    "en finir avec ma vie", "me suicider",
    "suicide", "kill myself", "self harm",
  ],
  "zh-CN": [
    "想死", "不想活了",
    "想消失",
    "自残",
    "自杀", "想自杀",
    "结束自己的生命",
    "suicide", "kill myself", "self harm",
  ],
  "zh-HK": [
    "想死", "不想活了",
    "想消失",
    "自殘",
    "自殺", "想自殺",
    "結束自己的生命",
    "suicide", "kill myself", "self harm",
  ],
  "zh-TW": [
    "想死", "不想活了",
    "想消失",
    "自殘",
    "自殺", "想自殺",
    "結束自己的生命",
    "suicide", "kill myself", "self harm",
  ],
};

/**
 * Ambiguous markers — meaning depends entirely on the object being acted
 * on ("일을 끝내고 싶다" vs "삶을 끝내고 싶다"). Never auto-safe: only
 * cleared when the current sentence, or (if the sentence has no object at
 * all) recent context, supplies a non-life object. See checkSafetyBoundary.
 */
const AMBIGUOUS_CRISIS_MARKERS: Record<Locale, string[]> = {
  ko: ["끝내고 싶"],
  // "終わりにしたい"/"終わらせたい" — same ambiguity as Korean: could be
  // "仕事を終わらせたい" (finish work) or "人生を終わりにしたい" (end life).
  ja: ["終わりにしたい", "終わらせたい"],
  // "end it all" / "want it to be over" — the classic English ambiguous
  // phrase (could mean a task/project ending, or something more
  // serious), same role as ko's "끝내고 싶"/ja's "終わりにしたい".
  en: ["end it all", "want it to be over", "put an end to it"],
  // 7-Locale Runtime Output Support Gate — same ambiguity as ko/ja/en:
  // could mean a task/project ending, or something more serious.
  fr: ["en finir", "que ça s'arrête", "mettre fin à tout"],
  "zh-CN": ["想结束", "想了结", "一了百了"],
  "zh-HK": ["想結束", "想了結", "一了百了"],
  "zh-TW": ["想結束", "想了結", "一了百了"],
};

/** If a life/self object co-occurs with an ambiguous marker, it stays
 *  crisis regardless of any task object also present in the same
 *  sentence (e.g. "일도 삶도 다 끝내고 싶다"). */
const LIFE_OBJECT_MARKERS: Record<Locale, string[]> = {
  ko: ["삶", "인생", "목숨", "생명", "모든 것", "모든 걸"],
  ja: ["人生", "命", "生命", "すべて", "全部"],
  en: ["my life", "life", "everything", "living"],
  fr: ["ma vie", "vie", "tout", "vivre"],
  "zh-CN": ["生命", "人生", "一切", "全部"],
  "zh-HK": ["生命", "人生", "一切", "全部"],
  "zh-TW": ["生命", "人生", "一切", "全部"],
};

/** Minimal reuse of domainEngine.ts's "work" domain keywords — only what's
 *  needed to recognize a task/work object clearing an ambiguous marker. */
const WORK_OBJECT_MARKERS: Record<Locale, string[]> = {
  ko: ["일", "업무", "회사", "직장", "프로젝트", "회의", "보고", "마감", "과제", "작업", "숙제", "출근", "야근"],
  ja: ["仕事", "業務", "会社", "職場", "プロジェクト", "会議", "報告", "締め切り", "締切", "課題", "作業", "宿題", "出勤", "残業"],
  en: ["work", "job", "project", "meeting", "deadline", "report", "assignment", "shift", "overtime", "task"],
  fr: ["travail", "boulot", "projet", "réunion", "rapport", "délai", "échéance", "devoir", "tâche", "heures supplémentaires"],
  "zh-CN": ["工作", "上班", "公司", "职场", "项目", "会议", "报告", "截止日期", "作业", "任务", "加班"],
  "zh-HK": ["工作", "返工", "公司", "職場", "項目", "會議", "報告", "死線", "功課", "任務", "加班"],
  "zh-TW": ["工作", "上班", "公司", "職場", "專案", "會議", "報告", "期限", "作業", "任務", "加班"],
};

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
 *
 * `locale` defaults to "ko" — every existing caller from before the
 * Multilingual Gate keeps byte-identical Korean-only behavior.
 */
export function checkSafetyBoundary(inputText: string, recentUserTexts: string[] = [], locale: Locale = "ko"): SafetyResult {
  const text = inputText.toLowerCase();

  if (includesAny(text, SELF_CONTAINED_CRISIS_MARKERS[locale])) {
    return { safe: false, message: CRISIS_MESSAGE[locale] };
  }

  if (includesAny(text, AMBIGUOUS_CRISIS_MARKERS[locale])) {
    if (includesAny(text, LIFE_OBJECT_MARKERS[locale])) {
      return { safe: false, message: CRISIS_MESSAGE[locale] };
    }
    if (includesAny(text, WORK_OBJECT_MARKERS[locale])) {
      return { safe: true };
    }

    const recentContext = recentUserTexts.join(" ").toLowerCase();
    if (includesAny(recentContext, WORK_OBJECT_MARKERS[locale])) {
      return { safe: true };
    }

    return { safe: false, message: CRISIS_MESSAGE[locale] };
  }

  return { safe: true };
}
