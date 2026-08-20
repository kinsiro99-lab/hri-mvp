/**
 * HRI New Question Core — Prototype 1 (isolated, rollback-safe).
 *
 * Not a replacement of understandingEngine.ts/questionPlanner.ts — both
 * files are untouched and still fully present. This module is wired in
 * by controller.ts behind a single boolean toggle
 * (USE_PROTOTYPE_QUESTION_CORE); setting that flag to false restores
 * byte-identical old behavior with zero further changes.
 *
 * Deliberately minimal per this Sprint's brief: no role taxonomy, no
 * relation graph, no confidence model, no complex identity structure.
 * The only two judgment calls this file makes are certainty (a small
 * explicit marker list — never silently promoted to a confident value)
 * and correction (marking the prior active item superseded — never
 * deleting it). Every other turn is preserved verbatim, unconditionally.
 */
import { devLog } from "../../devLog";
import type { Locale } from "../locale";

export type Certainty = "stated" | "uncertain";
export type EvidenceStatus = "active" | "superseded";

export type EvidenceItem = {
  text: string;
  turn: number;
  certainty: Certainty;
  status: EvidenceStatus;
};

/**
 * Gate 23 — "link-first"/"link-continue" added. Both exist to break the
 * old "every non-terse, non-correction, non-uncertain turn falls to
 * expand" failure (Gate 19/21 finding: CASE Q T1-T3 all rendered the
 * identical expand template). Neither reads evidence *meaning* — the
 * choice between them is purely "how many Probes/Understanding entries
 * exist in this session so far" (see decideNextQuestion below), the
 * same kind of structural/procedural fact `length <= 3` already was.
 */
export type QuestionIntent =
  | "expand"
  | "clarify"
  | "confirm-change"
  | "acknowledge-uncertainty"
  | "link-first"
  | "link-continue";

export type QuestionDecision = {
  triggerEvidence: string | null;
  focus: string;
  intent: QuestionIntent;
  reason: string;
  /** Gate 23 — set only for link-first, when the evidence immediately
   *  preceding the trigger in the array is still active. Never read as
   *  a semantic claim about *why* the two are related — it exists only
   *  so the link-first template can quote both turns instead of one. */
  anchorFocus?: string;
};

/* =========================================================
 * Gate 23 — Probe / Provisional Understanding.
 *
 * Two new state types, kept deliberately separate from each other (see
 * Gate 22 §3/§12): a Probe is never itself an Understanding fact, and an
 * UnderstandingEntry never stores anything the user didn't literally
 * say (see applyEvidenceToUnderstanding below — `value` is always a
 * verbatim EvidenceItem.text, never a paraphrase or synthesized label).
 *
 * ProbeStatus is deliberately just two states, not the three Gate 22
 * sketched ("unaddressed" doesn't have a distinct transition trigger in
 * this prototype — a Probe simply stays "asked" if no further turn ever
 * arrives, which needs no separate state to represent).
 *
 * confidence stays two states too, per Gate 23's explicit instruction:
 * "confirmed" is left in the type for future use but this file never
 * constructs one. Nothing here promotes provisional -> confirmed.
 * ========================================================= */
export type ProbeStatus = "asked" | "addressed";

export type Probe = {
  id: string;
  /** The EvidenceItem.text this probe was actually asked about — same
   *  value the old QuestionDecision.triggerEvidence carried, now
   *  persisted turn-to-turn instead of being transient. */
  anchorEvidenceText: string;
  /** The literal text shown to the user this turn — kept so nothing
   *  downstream can ever confuse "what HRI said" with "what the user
   *  said" (EvidenceItem.text is the only place user words live). */
  renderedText: string;
  intent: QuestionIntent;
  turn: number;
  status: ProbeStatus;
};

export type UnderstandingStatus = "provisional" | "confirmed" | "superseded";

export type UnderstandingEntry = {
  id: string;
  /** Always a verbatim EvidenceItem.text (the new answer, for a
   *  probe-linked entry; the correction text itself, for a
   *  correction-triggered entry) — never a paraphrase, never a
   *  synthesized label. This is enforced by construction in
   *  applyEvidenceToUnderstanding, not by a runtime check. */
  value: string;
  /** Provenance chain: which EvidenceItem.text(s) this entry traces
   *  back to. Always >= 1 entry, by construction. */
  sourceEvidenceTexts: string[];
  /** Which Probe this entry answers, when it does. Undefined for a
   *  correction-triggered entry (Gate 22 §7/§9: a correction is not
   *  treated as "answering" whatever probe happened to be open — it is
   *  a spontaneous self-correction of a prior claim, not evidence that
   *  the user endorsed the open probe's premise). */
  respondsToProbeId?: string;
  status: UnderstandingStatus;
  /** Id of the UnderstandingEntry that superseded this one. Set only
   *  when status flips to "superseded"; the entry itself is never
   *  deleted or mutated in place beyond this and `status`. */
  supersededBy?: string;
  turn: number;
};

/**
 * Gate 23 — called once per turn, before this turn's new Probe is
 * decided. Marks the single most recently asked Probe (if any, if still
 * "asked") as "addressed". Deliberately a weak, purely positional
 * signal: it fires whenever *any* new evidence exists this turn,
 * regardless of whether that evidence is actually topically related to
 * the probe (see Gate 22 §8 — no relatedness classifier exists or is
 * added here). This weakness is intentional and is exactly why
 * "addressed" alone is never allowed to produce a "confirmed"
 * UnderstandingEntry — only "provisional" (see applyEvidenceToUnderstanding).
 */
export function markMostRecentProbeAddressed(probes: Probe[]): Probe[] {
  if (probes.length === 0) return probes;
  const lastIdx = probes.length - 1;
  if (probes[lastIdx].status !== "asked") return probes;
  const next = probes.map((p, i) => (i === lastIdx ? { ...p, status: "addressed" as ProbeStatus } : p));
  devLog("PROTOTYPE PROBE ADDRESSED:", { probeId: next[lastIdx].id, anchor: next[lastIdx].anchorEvidenceText });
  return next;
}

/**
 * Gate 23 — the only place UnderstandingEntry objects are created.
 * `value` is always `newEvidence.text` verbatim (never derived,
 * paraphrased, or looked up from a keyword group) — this is the
 * concrete enforcement of the "origin is an invariant, not a field"
 * decision from Gate 22 §4.
 *
 * Two, and only two, ways an entry gets created:
 * - correction: the new evidence itself becomes a fresh, UNLINKED
 *   provisional entry (respondsToProbeId left undefined — see the
 *   UnderstandingEntry doc above), and any existing provisional entry
 *   whose source text was just superseded is cascaded to
 *   status="superseded" (never deleted).
 * - probe answered: only when `addressedProbe` is passed (i.e. a Probe
 *   was open and this turn's evidence is not itself a correction) —
 *   the new entry links back to that probe's anchor evidence AND this
 *   turn's evidence, respondsToProbeId set.
 * Anything else (first-ever evidence, no open probe, not a correction)
 * produces no entry — matching Gate 22 §7's rule that raw, unprompted
 * Evidence does not by itself warrant an Understanding entry.
 */
export function applyEvidenceToUnderstanding(args: {
  priorUnderstanding: UnderstandingEntry[];
  addressedProbe: Probe | undefined;
  newEvidence: EvidenceItem;
  wasCorrection: boolean;
  supersededEvidenceText?: string;
  turn: number;
}): UnderstandingEntry[] {
  const { priorUnderstanding, addressedProbe, newEvidence, wasCorrection, supersededEvidenceText, turn } = args;
  const id = `u${turn}`;

  let base = priorUnderstanding;
  if (wasCorrection && supersededEvidenceText) {
    base = base.map((u) =>
      u.status === "provisional" && u.sourceEvidenceTexts.includes(supersededEvidenceText)
        ? { ...u, status: "superseded" as UnderstandingStatus, supersededBy: id }
        : u,
    );
  }

  let next: UnderstandingEntry[];
  if (wasCorrection) {
    next = [
      ...base,
      { id, value: newEvidence.text, sourceEvidenceTexts: [newEvidence.text], status: "provisional", turn },
    ];
  } else if (addressedProbe) {
    next = [
      ...base,
      {
        id,
        value: newEvidence.text,
        sourceEvidenceTexts: [addressedProbe.anchorEvidenceText, newEvidence.text],
        respondsToProbeId: addressedProbe.id,
        status: "provisional",
        turn,
      },
    ];
  } else {
    next = base;
  }

  devLog("PROTOTYPE UNDERSTANDING UPDATE:", {
    turn,
    wasCorrection,
    supersededEvidenceText,
    respondsToProbeId: wasCorrection ? undefined : addressedProbe?.id,
    createdEntry: next.length > base.length ? next[next.length - 1] : null,
    totalEntries: next.length,
  });
  return next;
}

const UNCERTAIN_MARKERS: Record<Locale, string[]> = {
  ko: ["모르겠다", "모르겠어", "설명하기 어렵다", "잘 모르", "뭐라고 설명"],
  // Multilingual Gate — Japanese equivalents, not mechanical translation:
  // "わからない/分からない" (don't know), "説明が難しい"/"うまく説明できない"
  // (hard to explain / can't put it into words), "何と言えばいいか" (not
  // sure how to put it) parallels Korean's "뭐라고 설명" (lit. "what to
  // explain").
  ja: ["わからない", "分からない", "説明が難しい", "うまく説明できない", "何と言えばいいか"],
  // Multilingual Gate — English. Matched case-insensitively (see
  // isUncertain below) since Latin script varies case naturally at
  // sentence-start unlike Korean/Japanese — markers stored lowercase.
  en: ["i don't know", "i do not know", "not sure how to explain", "hard to explain", "i'm not sure"],
};
const CORRECTION_MARKERS: Record<Locale, string[]> = {
  ko: ["아니다", "아니야", "사실은", "사실 아직", "아직 결정된 것은 아니다", "그게 아니라"],
  // "違う/違います" (that's not it), "実は" (actually), "そうじゃなくて"/
  // "そうではなくて" (that's not what I mean), "まだ決まっていない"
  // parallels Korean's "아직 결정된 것은 아니다" (not decided yet).
  ja: ["違う", "違います", "実は", "そうじゃなくて", "そうではなくて", "まだ決まっていない"],
  // English "actually"/"no" alone are too common (would over-trigger —
  // conservative matching per Beta Handoff §6) — these are the fuller
  // phrases that actually signal a correction, same conservatism as
  // ja's full-phrase choices above.
  en: ["actually, no", "no, that's not it", "that's not right", "wait, actually", "on second thought", "i take that back"],
};

/** English is matched case-insensitively (markers stored lowercase) —
 *  Latin script varies case naturally (e.g. sentence-initial "I don't
 *  know") in a way Korean/Japanese do not. ko/ja stay exactly as
 *  before this Gate: raw, case-sensitive substring match. */
function isUncertain(text: string, locale: Locale): boolean {
  const cmp = locale === "en" ? text.toLowerCase() : text;
  return UNCERTAIN_MARKERS[locale].some((m) => cmp.includes(m));
}

function isCorrection(text: string, locale: Locale): boolean {
  const cmp = locale === "en" ? text.toLowerCase() : text;
  return CORRECTION_MARKERS[locale].some((m) => cmp.includes(m));
}

function lastActiveIndex(evidence: EvidenceItem[]): number {
  for (let i = evidence.length - 1; i >= 0; i--) {
    if (evidence[i].status === "active") return i;
  }
  return -1;
}

/**
 * Every turn's raw text becomes exactly one new EvidenceItem, verbatim,
 * unconditionally — no keyword classifier decides whether to keep it
 * (the "silent loss because it didn't match a pattern" failure mode
 * this Sprint exists to fix). Returns whether this update was a
 * correction so the caller can pass that fact to decideNextQuestion
 * without re-deriving it from the array.
 */
export function updateEvidence(
  priorEvidence: EvidenceItem[],
  text: string,
  turn: number,
  locale: Locale = "ko",
): {
  evidence: EvidenceItem[];
  newEvidence: EvidenceItem;
  wasCorrection: boolean;
  understandingChange: string;
  /** Gate 23 — the text of whichever prior EvidenceItem this turn's
   *  correction actually superseded, undefined when this turn was not
   *  a correction or had nothing to supersede. Additive only: every
   *  existing field/behavior above is unchanged. Lets a caller cascade
   *  the same supersession into a separate Understanding layer without
   *  re-deriving it from `understandingChange`'s free text. */
  supersededText?: string;
} {
  const trimmed = text.trim();
  const certainty: Certainty = isUncertain(trimmed, locale) ? "uncertain" : "stated";
  const correction = isCorrection(trimmed, locale);
  const newEvidence: EvidenceItem = { text: trimmed, turn, certainty, status: "active" };

  let nextEvidence: EvidenceItem[];
  let understandingChange: string;
  let supersededText: string | undefined;

  if (correction) {
    const idx = lastActiveIndex(priorEvidence);
    if (idx === -1) {
      nextEvidence = [...priorEvidence, newEvidence];
      understandingChange = `correction marker seen, but no prior active evidence to supersede — appended as new`;
    } else {
      supersededText = priorEvidence[idx].text;
      nextEvidence = priorEvidence.map((e, i) => (i === idx ? { ...e, status: "superseded" as EvidenceStatus } : e));
      nextEvidence = [...nextEvidence, newEvidence];
      understandingChange = `correction: "${supersededText}" marked superseded by new evidence "${trimmed}"`;
    }
  } else {
    nextEvidence = [...priorEvidence, newEvidence];
    understandingChange =
      certainty === "uncertain"
        ? `new evidence appended (uncertain, not promoted to a confident claim): "${trimmed}"`
        : `new evidence appended (stated): "${trimmed}"`;
  }

  devLog("PROTOTYPE EVIDENCE UPDATE:", { input: trimmed, certainty, correction, understandingChange, evidenceCount: nextEvidence.length });
  return {
    evidence: nextEvidence,
    newEvidence,
    wasCorrection: correction && lastActiveIndex(priorEvidence) !== -1,
    understandingChange,
    supersededText,
  };
}

/**
 * Always anchored to the NEWEST not-yet-used evidence item — never a
 * stale/frozen earlier value, never a "next empty slot" walk. Returns
 * null when there is nothing new to ask about (caller decides
 * fallback/reflection, same as the old planner's null contract).
 *
 * Gate 23 — priority order, highest first, unchanged from before this
 * Gate for the first three checks (uncertain > correction > terse).
 * Only the final fallback (previously always "expand") is now split by
 * two purely procedural counts the caller already has to hand:
 *
 * - priorProbeCount === 0: no Probe has ever been asked this session
 *   (this is necessarily the very first turn) -> "expand", byte-
 *   identical wording to before this Gate. There is nothing to link to
 *   yet, so nothing changes here.
 * - priorUnderstandingCount === 0 (but a Probe already exists): this
 *   session's first-ever provisional link is about to be formed ->
 *   "link-first".
 * - priorUnderstandingCount >= 1: a thread is already forming ->
 *   "link-continue".
 *
 * Neither new branch reads what the evidence *means* — both read only
 * "how many Probes/Understanding entries exist so far", the same kind
 * of structural fact `trigger.text.length <= 3` already was. This is
 * the direct fix for the Gate 19/21 finding that CASE Q T1-T3 all fell
 * to the identical "expand" template regardless of what changed.
 */
export function decideNextQuestion(
  evidence: EvidenceItem[],
  usedTriggers: ReadonlySet<string>,
  latestWasCorrection: boolean,
  priorProbeCount: number,
  priorUnderstandingCount: number,
): QuestionDecision | null {
  const candidates = evidence.filter((e) => e.status === "active" && !usedTriggers.has(e.text));
  if (candidates.length === 0) return null;

  const trigger = candidates[candidates.length - 1];
  // Reference equality is safe here: `candidates` is a filter() of
  // `evidence`, so `trigger` is the exact same object instance.
  const triggerIdx = evidence.indexOf(trigger);

  let intent: QuestionIntent;
  let reasonNote: string;
  let anchorFocus: string | undefined;

  if (trigger.certainty === "uncertain") {
    intent = "acknowledge-uncertainty";
    reasonNote = "trigger marked uncertain — not promoted to a confident claim";
  } else if (latestWasCorrection && trigger.status === "active") {
    intent = "confirm-change";
    reasonNote = "trigger is a correction of a prior active evidence item";
  } else if (trigger.text.length <= 3) {
    intent = "clarify";
    reasonNote = "trigger is very short/terse, asking for elaboration";
  } else if (priorProbeCount === 0) {
    intent = "expand";
    reasonNote = "no Probe has ever been asked this session (genesis turn)";
  } else if (priorUnderstandingCount === 0) {
    intent = "link-first";
    reasonNote = "a Probe exists but no Understanding entry has formed yet — first link";
    const precedingItem = triggerIdx > 0 ? evidence[triggerIdx - 1] : undefined;
    anchorFocus = precedingItem && precedingItem.status === "active" ? precedingItem.text : undefined;
  } else {
    intent = "link-continue";
    reasonNote = `${priorUnderstandingCount} Understanding entr${priorUnderstandingCount === 1 ? "y" : "ies"} already exist — continuing the thread`;
  }

  const decision: QuestionDecision = {
    triggerEvidence: trigger.text,
    focus: trigger.text,
    intent,
    reason: `triggerEvidence="${trigger.text}"(turn${trigger.turn}) -> intent=${intent} (${reasonNote})`,
    anchorFocus,
  };
  devLog("PROTOTYPE QUESTION DECISION:", decision);
  return decision;
}

// Dash-quote aside pattern: the variable `focus` is never grammatically
// attached to a Korean case particle — every particle in these
// templates attaches to a FIXED preceding word ("말씀"/"내용"), never to
// `focus` itself, so no template can produce a particle/batchim clash
// regardless of what the user's raw text ends in (the exact bug class
// found in reflectionComposer.ts's "'...다'이라는" pattern).
const TEMPLATES: Record<QuestionIntent, (focus: string, anchor?: string) => string> = {
  expand: (f) => `방금 하신 말씀 — '${f}' — 에서, 조금 더 떠오르는 것이 있다면 무엇인가요?`,
  clarify: (f) => `방금 하신 말씀 — '${f}' — 을 조금 더 구체적으로 표현하면 어떻게 될까요?`,
  "confirm-change": (f) => `방금 정정해 주신 내용 — '${f}' — 을 기준으로 다시 여쭤볼게요. 지금 가장 걸리는 부분은 무엇인가요?`,
  "acknowledge-uncertainty": (f) =>
    `방금 하신 말씀 — '${f}' — 은 지금 뚜렷하게 설명하기 어려우신 것 같아요. 그래도 지금 마음에 걸리는 게 있다면 편하게 말씀해 주세요.`,
  // Gate 23 — quotes BOTH the anchor (what was just linked FROM) and the
  // focus (what was just linked TO) when the anchor is still active;
  // falls back to the plain expand wording when it isn't (e.g. the
  // anchor was itself later superseded). Same "dash-quote aside"
  // pattern as expand/clarify above — "에", "도" always attach to the
  // fixed word "말씀", never directly to quoted user text.
  "link-first": (f, anchor) =>
    anchor
      ? `방금 하신 말씀 — '${anchor}' — 에 이어, 이번 말씀 — '${f}' — 도 있었습니다. 이 둘을 이어서 보면, 조금 더 떠오르는 것이 있을까요?`
      : `방금 하신 말씀 — '${f}' — 에서, 조금 더 떠오르는 것이 있다면 무엇인가요?`,
  "link-continue": (f) =>
    `지금까지 이어져 온 말씀에 이번 말씀 — '${f}' — 이 더해졌습니다. 여기서 조금 더 짚이는 게 있다면 무엇인가요?`,
};

export function renderQuestion(decision: QuestionDecision): string {
  const text = TEMPLATES[decision.intent](decision.focus, decision.anchorFocus);
  devLog("PROTOTYPE QUESTION RENDER:", text);
  return text;
}
