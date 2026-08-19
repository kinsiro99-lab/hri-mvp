/**
 * HRI Question Phraser — Gate 27, Epistemic Stance pass (Gate 28).
 *
 * A SEPARATE, narrow LLM call from
 * ../context/providers/contextFirstSemanticAdapter.ts — deliberately
 * NOT a modification of that file's SYSTEM_PROMPT, which explicitly
 * states "you never generate a question" as a hard ordering guarantee
 * that file's own header documents as hard-won. This call's ONLY input
 * is an ALREADY-DECIDED, ALREADY-GROUNDED QuestionDecision
 * (intelligenceCore.ts's decideQuestion) — it never decides WHAT to
 * ask, only HOW to phrase it naturally in Korean. Every output is
 * structurally validated (validatePhrasedQuestion) before use; any
 * failure falls back to the deterministic template renderer
 * (renderProbeTemplate in intelligenceCore.ts).
 *
 * Gate 28 root cause (see Gate 28 report §A): the Decision layer was
 * already picking safe targets, but nothing told THIS layer how
 * certain the target was, so it was free to assert a feeling/cause/
 * priority the user never stated — "출장 준비로 인해 어떤 느낌이 드시나요?"
 * presumes a feeling exists and that it's caused by trip prep;
 * "먼저 처리하고 싶으신가요?" silently turns the user's own "해야 한다"
 * (must) into "싶다" (want). Fix: decision.epistemicStance
 * (user-stated / hypothesis / open-probe, see types.ts) now drives
 * BOTH the prompt (different phrasing instructions per stance) and
 * validation (different marker checks per stance) — a hypothesis may
 * be referenced, but only hedged; a user-stated or open-probe question
 * must not presume a feeling/cause/priority at all.
 */
import type { EpistemicStance, QuestionDecision } from "./types";

const MODEL = "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

export type PhraseCallOutcome = "SUCCESS" | "SKIPPED" | "TECHNICAL_FAILURE" | "VALIDATION_FAILURE";
export type PhraseCallStat = { turn: number; outcome: PhraseCallOutcome; latencyMs: number; errorMessage?: string };

const STANCE_RULES: Record<EpistemicStance, string> = {
  "user-stated": `Epistemic stance: USER-STATED. Everything you may reference is literally what the user already said. Ask them to say more about it in their own direction — do NOT ask "how do you feel about X" or "why" unless the user's own words already named a feeling or a cause. Do NOT reframe an obligation ("해야 한다"/must) as a desire ("싶다"/want), and do NOT presume a priority/order ("먼저"/first) the user did not state. A safe pattern: invite elaboration on the content itself, not on an unstated reaction to it.`,
  "hypothesis": `Epistemic stance: HYPOTHESIS. "HRI's current provisional reading" below is HRI's OWN inference, not something the user confirmed. You MUST phrase the question so it is clearly offered as a guess the user can freely correct or reject — use a natural Korean hedge (e.g. "~인 것 같은데, 맞을까요", "~일까요", "혹시 ~와 관련이 있을까요", "~로 보이는데 어떠신가요"). Never state the hypothesis as settled fact. Never phrase it as a yes/no confirmation with no room to redirect — leave the user an easy, natural way to say "아니, 사실은 ~".`,
  "open-probe": `Epistemic stance: OPEN-PROBE. There is no confirmed direction, feeling, or cause here — the provider explicitly could not decide one. Ask a genuinely open question that invites the user to say whatever comes to mind. Do NOT presume any particular feeling, cause, or priority, and do NOT narrow the question toward one likely answer.`,
};

const SYSTEM_PROMPT = `You are phrasing ONE short natural Korean question for a human reflection tool called AURINA ("마음의 거울"). You do NOT decide what to ask — that has already been decided for you. You only phrase it naturally.

Rules:
1. Write ONLY in Korean. Never mix in English.
2. The question must end with a question mark and read like something a calm, attentive person would actually say out loud — not a form field, not a counseling manual, not a survey.
3. Never introduce a fact, name, cause, or emotion that is not already present in the "grounding" text you are given. You may refer to it in your own natural words, but you may not add new content.
4. Never phrase the question so that it presumes or leads toward one particular answer. Open the user's own next thought — do not confirm a conclusion you already reached for them.
5. Keep it short — one sentence, no preamble, no bullet points, no meta-commentary like "질문:" or "다음은".
6. Do not start with "지금까지의 말씀을 보면" or "조금 더 떠오르는 것이 있다면" — vary the opening naturally instead of falling back to a fixed phrase.
7. Follow the "Epistemic stance" instruction you are given below EXACTLY — it tells you how confidently you are allowed to phrase this specific question.
8. Return ONLY the question text itself, nothing else — no quotation marks around it.`;

function buildUserPrompt(decision: QuestionDecision): string {
  const parts: string[] = [];
  parts.push(STANCE_RULES[decision.epistemicStance]);
  parts.push(`purpose: ${decision.reason}`);
  parts.push(`grounding (the ONLY source of content you may reference): ${decision.evidenceRefs.map((e) => `"${e}"`).join(" / ")}`);
  if (decision.hypothesisStatement) {
    parts.push(`HRI's current provisional reading (not a confirmed fact — do not assert it as true): "${decision.hypothesisStatement}"`);
  }
  if (decision.updateContext) {
    const u = decision.updateContext;
    parts.push(`what just happened: the user's latest turn ${u.identityRelation} an existing ${u.targetKind} (updateKind=${u.updateKind}) — HRI's note on the change: "${u.note}"`);
  }
  if (decision.relationContext) {
    const r = decision.relationContext;
    parts.push(`a relation was found: a ${r.fromKind} ("${r.fromStatement}") ${r.relationType} a ${r.toKind} ("${r.toStatement}")`);
  }
  if (decision.connectionContext) {
    const c = decision.connectionContext;
    parts.push(`two things are both on the table but NOT yet explicitly connected by anything the user or HRI has said: a newer ${c.newerKind} ("${c.newerStatement}") and an older ${c.olderKind} ("${c.olderStatement}"). Ask, genuinely openly, whether/how they relate for the user — do NOT propose or imply a specific relationship (not cause, not priority, not sequence) yourself; just name both and invite the user to say if there's a connection.`);
  }
  if (decision.elementKind) parts.push(`element kind: ${decision.elementKind}`);
  parts.push(`Write the ONE Korean question now.`);
  return parts.join("\n");
}

const MAX_LEN = 90; // "짧고 명확하며" — Gate 27 §11
const BANNED_OPENERS = ["지금까지의 말씀을 보면", "조금 더 떠오르는 것이 있다면"];

function tokenSet(text: string): Set<string> {
  return new Set(text.split(/[\s,.!?"'—()]+/).filter((w) => w.length >= 2));
}

function groundingText(decision: QuestionDecision): string {
  const parts = [...decision.evidenceRefs];
  if (decision.hypothesisStatement) parts.push(decision.hypothesisStatement);
  if (decision.relationContext) parts.push(decision.relationContext.fromStatement, decision.relationContext.toStatement);
  if (decision.connectionContext) parts.push(decision.connectionContext.newerStatement, decision.connectionContext.olderStatement);
  return parts.join(" ");
}

/**
 * Gate 28 §1 — the exact markers found injecting an unstated
 * feeling/cause/priority into Gate 27's real output ("어떤 느낌이
 * 드시나요", "때문에"/"로 인해", "먼저 처리하고 싶으신가요"). Same
 * "small, fixed, literal marker list for a STRUCTURAL check on
 * generated text" idiom already established and approved throughout
 * this codebase (questionCorePrototype.ts's CORRECTION_MARKERS/
 * UNCERTAIN_MARKERS, reflectionComposer.ts's REASON/CONTRAST/
 * CONCLUSION_MARKERS) — this is not a truth classifier over user
 * input, it is a safety check over HRI's OWN generated question text.
 */
/**
 * { marker: the exact ending/phrase to detect in generated question
 *   text, stem: a hand-picked Korean content root to check against the
 *   grounding text }. Deliberately a fixed lookup table, not a
 *   programmatic suffix-strip — Korean conjugation (batchim, irregular
 *   stems) makes a generic English-style regex strip unreliable (e.g.
 *   stripping "시나요" off "힘드시나요" leaves "힘드", which is NOT a
 *   substring of the user's own "힘들다" — 드 and 들 are different
 *   syllables). A hand-picked stem per marker avoids that failure mode.
 */
const PRESUMPTION_MARKERS: Array<{ marker: string; stem: string }> = [
  { marker: "힘드시나요", stem: "힘들" }, { marker: "힘든가요", stem: "힘들" },
  { marker: "힘들지 않으신가요", stem: "힘들" }, { marker: "힘드신가요", stem: "힘들" },
  { marker: "느낌이 드시나요", stem: "느낌" }, { marker: "불안하신가요", stem: "불안" },
  { marker: "속상하신가요", stem: "속상" }, { marker: "답답하신가요", stem: "답답" },
  { marker: "괜찮으신가요", stem: "괜찮" }, { marker: "스트레스 받으시나요", stem: "스트레스" },
  { marker: "부담되시나요", stem: "부담" }, { marker: "부담스러우신가요", stem: "부담" },
  { marker: "걱정되시나요", stem: "걱정" }, { marker: "지치셨나요", stem: "지치" },
  { marker: "지치시나요", stem: "지치" },
  { marker: "때문에", stem: "때문에" }, { marker: "탓에", stem: "탓에" },
  { marker: "로 인해", stem: "로 인해" }, { marker: "인해서", stem: "인해서" },
  { marker: "싶으신가요", stem: "싶" }, { marker: "싶나요", stem: "싶" },
  { marker: "싶으세요", stem: "싶" }, { marker: "하고 싶", stem: "싶" },
];
const HEDGE_MARKERS = [
  "것 같", "일까요", "혹시", "같아 보이", "것으로 보이", "수도 있",
  "인지 궁금", "인 걸까요", "아닐까요", "것처럼 보이", "로 보이는데",
];

function findUngroundedPresumption(text: string, ground: string): string | null {
  for (const { marker, stem } of PRESUMPTION_MARKERS) {
    if (text.includes(marker) && !ground.includes(stem)) return marker;
  }
  return null;
}

/**
 * Structural-only validation — same overlap-ratio spirit as
 * ../context/validator.ts's V2, never a semantic "is this a GOOD
 * question" judgment. Gate 28 adds stance-specific checks: user-stated/
 * open-probe questions may not contain an ungrounded emotion/cause/
 * desire-reframe marker at all; a hypothesis-stance question MUST
 * contain at least one hedge marker (an assertive hypothesis is exactly
 * the failure mode this Gate exists to catch).
 */
export function validatePhrasedQuestion(text: string, decision: QuestionDecision): { ok: true } | { ok: false; reason: string } {
  const trimmed = text.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.length > MAX_LEN) return { ok: false, reason: `too long (${trimmed.length} chars)` };
  if (!/[?？]$/.test(trimmed)) return { ok: false, reason: "does not end in a question mark" };
  if (!/[가-힣]/.test(trimmed)) return { ok: false, reason: "contains no Hangul" };
  if (/[A-Za-z]{3,}/.test(trimmed)) return { ok: false, reason: "contains an English word — language contract violation" };
  if (BANNED_OPENERS.some((o) => trimmed.startsWith(o))) return { ok: false, reason: "fell back to a banned fixed opener" };

  const ground = groundingText(decision);

  if (decision.epistemicStance === "user-stated" || decision.epistemicStance === "open-probe") {
    const hit = findUngroundedPresumption(trimmed, ground);
    if (hit) {
      return { ok: false, reason: `epistemicStance=${decision.epistemicStance} but question presumes an ungrounded feeling/cause/priority via "${hit}"` };
    }
  }

  if (decision.epistemicStance === "hypothesis") {
    const hasHedge = HEDGE_MARKERS.some((h) => trimmed.includes(h));
    if (!hasHedge) {
      return { ok: false, reason: "epistemicStance=hypothesis but question has no hedge marker — asserts the hypothesis as settled fact" };
    }
  }

  const groundingTokens = new Set<string>();
  for (const t of tokenSet(ground)) groundingTokens.add(t);
  const questionTokens = tokenSet(trimmed);
  const overlap = [...questionTokens].filter((t) => groundingTokens.has(t)).length;
  if (questionTokens.size >= 3 && overlap === 0) {
    return { ok: false, reason: "shares no content with its own grounding — possible invented content" };
  }

  return { ok: true };
}

export async function phraseQuestion(
  decision: QuestionDecision,
  externalStats?: PhraseCallStat[],
): Promise<{ text: string | null; outcome: PhraseCallOutcome; errorMessage?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    externalStats?.push({ turn: decision.turn, outcome: "SKIPPED", latencyMs: 0, errorMessage: "OPENAI_API_KEY not set" });
    return { text: null, outcome: "SKIPPED", errorMessage: "OPENAI_API_KEY not set" };
  }

  const start = Date.now();
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(decision) },
        ],
        temperature: 0.4,
      }),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      externalStats?.push({ turn: decision.turn, outcome: "TECHNICAL_FAILURE", latencyMs, errorMessage: `HTTP ${res.status}: ${bodyText.slice(0, 200)}` });
      return { text: null, outcome: "TECHNICAL_FAILURE", errorMessage: `HTTP ${res.status}` };
    }
    const body = await res.json().catch(() => undefined);
    const content: string | undefined = body?.choices?.[0]?.message?.content;
    if (!content) {
      externalStats?.push({ turn: decision.turn, outcome: "TECHNICAL_FAILURE", latencyMs, errorMessage: "no content" });
      return { text: null, outcome: "TECHNICAL_FAILURE", errorMessage: "no content in provider response" };
    }
    const validation = validatePhrasedQuestion(content, decision);
    if (!validation.ok) {
      externalStats?.push({ turn: decision.turn, outcome: "VALIDATION_FAILURE", latencyMs, errorMessage: validation.reason });
      return { text: null, outcome: "VALIDATION_FAILURE", errorMessage: validation.reason };
    }
    externalStats?.push({ turn: decision.turn, outcome: "SUCCESS", latencyMs });
    return { text: content.trim().replace(/^["']|["']$/g, ""), outcome: "SUCCESS" };
  } catch (err) {
    externalStats?.push({ turn: decision.turn, outcome: "TECHNICAL_FAILURE", latencyMs: Date.now() - start, errorMessage: String(err) });
    return { text: null, outcome: "TECHNICAL_FAILURE", errorMessage: String(err) };
  }
}
