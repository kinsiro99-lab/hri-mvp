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

export type Certainty = "stated" | "uncertain";
export type EvidenceStatus = "active" | "superseded";

export type EvidenceItem = {
  text: string;
  turn: number;
  certainty: Certainty;
  status: EvidenceStatus;
};

export type QuestionIntent = "expand" | "clarify" | "confirm-change" | "acknowledge-uncertainty";

export type QuestionDecision = {
  triggerEvidence: string | null;
  focus: string;
  intent: QuestionIntent;
  reason: string;
};

const UNCERTAIN_MARKERS = ["모르겠다", "모르겠어", "설명하기 어렵다", "잘 모르", "뭐라고 설명"];
const CORRECTION_MARKERS = ["아니다", "아니야", "사실은", "사실 아직", "아직 결정된 것은 아니다", "그게 아니라"];

function isUncertain(text: string): boolean {
  return UNCERTAIN_MARKERS.some((m) => text.includes(m));
}

function isCorrection(text: string): boolean {
  return CORRECTION_MARKERS.some((m) => text.includes(m));
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
): { evidence: EvidenceItem[]; newEvidence: EvidenceItem; wasCorrection: boolean; understandingChange: string } {
  const trimmed = text.trim();
  const certainty: Certainty = isUncertain(trimmed) ? "uncertain" : "stated";
  const correction = isCorrection(trimmed);
  const newEvidence: EvidenceItem = { text: trimmed, turn, certainty, status: "active" };

  let nextEvidence: EvidenceItem[];
  let understandingChange: string;

  if (correction) {
    const idx = lastActiveIndex(priorEvidence);
    if (idx === -1) {
      nextEvidence = [...priorEvidence, newEvidence];
      understandingChange = `correction marker seen, but no prior active evidence to supersede — appended as new`;
    } else {
      const supersededText = priorEvidence[idx].text;
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
  return { evidence: nextEvidence, newEvidence, wasCorrection: correction && lastActiveIndex(priorEvidence) !== -1, understandingChange };
}

/**
 * Always anchored to the NEWEST not-yet-used evidence item — never a
 * stale/frozen earlier value, never a "next empty slot" walk. Returns
 * null when there is nothing new to ask about (caller decides
 * fallback/reflection, same as the old planner's null contract).
 */
export function decideNextQuestion(
  evidence: EvidenceItem[],
  usedTriggers: ReadonlySet<string>,
  latestWasCorrection: boolean,
): QuestionDecision | null {
  const candidates = evidence.filter((e) => e.status === "active" && !usedTriggers.has(e.text));
  if (candidates.length === 0) return null;

  const trigger = candidates[candidates.length - 1];

  let intent: QuestionIntent;
  let reasonNote: string;
  if (trigger.certainty === "uncertain") {
    intent = "acknowledge-uncertainty";
    reasonNote = "trigger marked uncertain — not promoted to a confident claim";
  } else if (latestWasCorrection && trigger.status === "active") {
    intent = "confirm-change";
    reasonNote = "trigger is a correction of a prior active evidence item";
  } else if (trigger.text.length <= 3) {
    intent = "clarify";
    reasonNote = "trigger is very short/terse, asking for elaboration";
  } else {
    intent = "expand";
    reasonNote = "trigger is new stated evidence, asking to expand on it";
  }

  const decision: QuestionDecision = {
    triggerEvidence: trigger.text,
    focus: trigger.text,
    intent,
    reason: `triggerEvidence="${trigger.text}"(turn${trigger.turn}) -> intent=${intent} (${reasonNote})`,
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
const TEMPLATES: Record<QuestionIntent, (focus: string) => string> = {
  expand: (f) => `방금 하신 말씀 — '${f}' — 에서, 조금 더 떠오르는 것이 있다면 무엇인가요?`,
  clarify: (f) => `방금 하신 말씀 — '${f}' — 을 조금 더 구체적으로 표현하면 어떻게 될까요?`,
  "confirm-change": (f) => `방금 정정해 주신 내용 — '${f}' — 을 기준으로 다시 여쭤볼게요. 지금 가장 걸리는 부분은 무엇인가요?`,
  "acknowledge-uncertainty": (f) =>
    `방금 하신 말씀 — '${f}' — 은 지금 뚜렷하게 설명하기 어려우신 것 같아요. 그래도 지금 마음에 걸리는 게 있다면 편하게 말씀해 주세요.`,
};

export function renderQuestion(decision: QuestionDecision): string {
  const text = TEMPLATES[decision.intent](decision.focus);
  devLog("PROTOTYPE QUESTION RENDER:", text);
  return text;
}
