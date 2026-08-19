/**
 * HRI Response Phraser — Response-Centered Conversation Core ("NEXT
 * GATE").
 *
 * A SEPARATE, narrow LLM call, same isolation principle as
 * questionPhraser.ts and the same reason: NOT a modification of
 * ../context/providers/contextFirstSemanticAdapter.ts's SYSTEM_PROMPT
 * (Semantic Understanding stays a separate concern from wording — see
 * that file's own header on why conflating them regressed before).
 * This call's ONLY input is an ALREADY-DECIDED ResponseDecision
 * (intelligenceCore.ts's decideResponse) — it never decides WHAT to
 * acknowledge, only HOW to say it naturally. Every output is
 * structurally validated (validatePhrasedResponse) before use; any
 * failure falls back to the deterministic template renderer
 * (renderResponseTemplate in intelligenceCore.ts).
 *
 * Three principles this file exists to enforce (Gate report §1/§2):
 *   A. TRUTH      — react only to what the user actually said.
 *   B. RESTRAINT  — never add emotion/cause/meaning/intensity beyond it.
 *   C. OPENNESS   — never push the user's next words in one direction.
 * Concretely this means the two patterns identified as violations in
 * the prior Gate's real output are now hard-banned, both in the prompt
 * AND in validatePhrasedResponse (never relying on the prompt alone):
 *   - "~와 연결되어 있는 것 같은데, 맞을까요?" (HRI asserts its own guess,
 *     then demands confirmation)
 *   - "둘 사이에 어떤 연결이 있을까요?" (asks the user to analyze a
 *     relationship instead of just saying what's on their mind)
 */
import type { ResponseDecision, ResponseMode } from "./types";

const MODEL = "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

export type ResponseCallOutcome = "SUCCESS" | "SKIPPED" | "TECHNICAL_FAILURE" | "VALIDATION_FAILURE";
export type ResponseCallStat = { turn: number; outcome: ResponseCallOutcome; latencyMs: number; errorMessage?: string };

const MODE_RULES: Record<ResponseMode, string> = {
  "acknowledge": `Mode: ACKNOWLEDGE. Simply reflect back that you heard what the user just said, in your own natural words — the classic reflective-listening move ("친구가 보고 싶다" -> "친구가 보고 싶으시군요"). Do not turn it into a question. Do not add any feeling, cause, or judgment the user's own sentence does not already contain.`,
  "acknowledge-continuity": `Mode: ACKNOWLEDGE-CONTINUITY. The user's latest words add to or specify something they said just before ("prior evidence" below). Name BOTH the prior and the latest content in ONE natural sentence — but you may NOT say or imply WHY or HOW they are connected, and you may NOT ask the user to explain the connection. Simply speak as if both are naturally part of the same thought, the way a person naturally would when someone adds detail to what they just said.`,
  "acknowledge-correction": `Mode: ACKNOWLEDGE-CORRECTION. The user just corrected or revised something they said. Accept it plainly and naturally, the way a good listener updates without making a fuss about the change. Do not ask why they changed their mind.`,
  "acknowledge-uncertainty": `Mode: ACKNOWLEDGE-UNCERTAINTY. The user expressed not being sure / not knowing. Accept that as completely fine, with no pressure to resolve it now. Do not ask a follow-up question that demands they figure it out.`,
  "ask": `Mode: ASK. Conversation Question Quality Gate — a genuine, narrow gap actually exists; asking closes it, an acknowledgment cannot. Two shapes only, matching "purpose" below: (1) the user voiced a guess/hedge without saying what led them to think so — ask for that basis alone, e.g. "그렇게 생각하게 된 계기가 있었나요?" — never assert whether the guess is true, never name a feeling for them. (2) the user only confirmed/agreed with no new content — ask about the next genuinely open part of the grounding given, not about the bare confirmation itself. The question's whole job is INFORMATION GAIN, not filling a turn: someone reading it should be able to say exactly what new fact it would surface. Never assert your own guess about how things relate and ask the user to confirm it. Never ask the user to analyze or explain a relationship between two things. Never demand a reason in a way that presumes one exists, force a priority, or force a choice.`,
};

const SYSTEM_PROMPT = `You are producing ONE short natural Korean conversational response for a human reflection tool called AURINA ("마음의 거울"). AURINA's purpose is not to ask good questions — it is to help the user feel genuinely heard so they can keep expressing whatever is actually on their mind, in their own words.

Three absolute rules (never break these, no matter what the mode instruction below suggests):

A. TRUTH — react only to content that is literally present in the "grounding" text given to you. Never introduce a fact, cause, emotion, or interpretation that is not already there.

B. RESTRAINT — never amplify. If the user did not name a feeling, do not name one for them. If they said "해야 한다" (must), never write "싶다" (want). If they mentioned several things, never rank or prioritize them.

C. OPENNESS — never push the user's next words toward one direction. This specifically means:
   - NEVER present your own guess about how things relate and ask the user to confirm it (e.g. "~와 연결되어 있는 것 같은데, 맞을까요?" is BANNED).
   - NEVER ask the user to analyze or explain a relationship between two things themselves (e.g. "둘 사이에 어떤 연결이 있을까요?" is BANNED).
   - NEVER demand a reason, force a priority, or force a choice among things the user mentioned.

Other rules:
1. Write ONLY in Korean. Never mix in English.
2. Short — one sentence, no preamble, no meta-commentary.
3. Read like something a calm, attentive, genuinely listening person would say — never a form, a survey, or a counseling manual.
4. Prefer NOT ending in a question mark unless the mode below is explicitly "ASK". A plain, warm statement is the default; the user's own open input box is always there for them to keep talking, so you do not need to prompt them with a question every turn.
5. Do not start with "지금까지의 말씀을 보면", "조금 더 떠오르는 것이 있다면", or any other fixed phrase — vary naturally.
6. Return ONLY the response text itself, nothing else — no quotation marks around it.`;

function buildUserPrompt(decision: ResponseDecision): string {
  const parts: string[] = [];
  parts.push(MODE_RULES[decision.mode]);
  parts.push(`purpose: ${decision.reason}`);
  parts.push(`grounding (the ONLY source of content you may reference): ${decision.evidenceRefs.map((e) => `"${e}"`).join(" / ")}`);
  if (decision.priorEvidenceRef) {
    parts.push(`prior evidence (the earlier thing this turn continues/specifies): "${decision.priorEvidenceRef}"`);
  }
  parts.push(`Write the ONE Korean response now.`);
  return parts.join("\n");
}

const MAX_LEN = 80;
const BANNED_OPENERS = ["지금까지의 말씀을 보면", "조금 더 떠오르는 것이 있다면"];

/**
 * §2's two banned patterns, as literal marker checks — never relying
 * on the prompt alone, same "structural safety net beyond the prompt"
 * discipline this codebase has used since questionCorePrototype.ts's
 * CORRECTION_MARKERS. Checked for EVERY acknowledge* mode regardless of
 * what the model was told, because a prompt instruction can be missed.
 */
const HYPOTHESIS_CONFIRM_MARKERS = ["것 같은데, 맞을까요", "것 같은데 맞을까요", "같은데, 맞나요", "같은데 맞나요", "맞을까요", "맞나요"];
const RELATION_ANALYSIS_MARKERS = ["연결이 있을까요", "관계가 있을까요", "어떻게 이어지", "이어지는지", "관련이 있을까요", "무슨 관계", "어떤 연결"];

function tokenSet(text: string): Set<string> {
  return new Set(text.split(/[\s,.!?"'—()]+/).filter((w) => w.length >= 2));
}

function groundingText(decision: ResponseDecision): string {
  const parts = [...decision.evidenceRefs];
  if (decision.priorEvidenceRef) parts.push(decision.priorEvidenceRef);
  return parts.join(" ");
}

/** Reused verbatim from questionPhraser.ts (Gate 28) — same
 *  Korean-morphology-safe stem-lookup design, same emotion/causal/
 *  desire-reframe presumption check. Restraint (§1.B) is at least as
 *  strict here as it was for Question wording. */
const PRESUMPTION_MARKERS: Array<{ marker: string; stem: string }> = [
  { marker: "힘드시나요", stem: "힘들" }, { marker: "힘든가요", stem: "힘들" },
  { marker: "힘들지 않으신가요", stem: "힘들" }, { marker: "힘드신가요", stem: "힘들" },
  { marker: "힘드시군요", stem: "힘들" }, { marker: "힘드시겠네요", stem: "힘들" },
  { marker: "느낌이 드시나요", stem: "느낌" }, { marker: "불안하신가요", stem: "불안" },
  { marker: "불안하시겠네요", stem: "불안" }, { marker: "속상하신가요", stem: "속상" },
  { marker: "속상하시겠네요", stem: "속상" }, { marker: "답답하신가요", stem: "답답" },
  { marker: "괜찮으신가요", stem: "괜찮" }, { marker: "스트레스 받으시나요", stem: "스트레스" },
  { marker: "부담되시나요", stem: "부담" }, { marker: "부담스러우신가요", stem: "부담" },
  { marker: "걱정되시나요", stem: "걱정" }, { marker: "걱정되시겠네요", stem: "걱정" },
  { marker: "지치셨나요", stem: "지치" }, { marker: "지치시나요", stem: "지치" },
  { marker: "지치셨겠네요", stem: "지치" }, { marker: "외로우시겠네요", stem: "외로" },
  { marker: "때문에", stem: "때문에" }, { marker: "탓에", stem: "탓에" },
  { marker: "로 인해", stem: "로 인해" }, { marker: "인해서", stem: "인해서" },
  { marker: "싶으신가요", stem: "싶" }, { marker: "싶나요", stem: "싶" },
  { marker: "싶으세요", stem: "싶" }, { marker: "하고 싶", stem: "싶" },
];

function findUngroundedPresumption(text: string, ground: string): string | null {
  for (const { marker, stem } of PRESUMPTION_MARKERS) {
    if (text.includes(marker) && !ground.includes(stem)) return marker;
  }
  return null;
}

export function validatePhrasedResponse(text: string, decision: ResponseDecision): { ok: true } | { ok: false; reason: string } {
  const trimmed = text.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.length > MAX_LEN) return { ok: false, reason: `too long (${trimmed.length} chars)` };
  if (!/[가-힣]/.test(trimmed)) return { ok: false, reason: "contains no Hangul" };
  if (/[A-Za-z]{3,}/.test(trimmed)) return { ok: false, reason: "contains an English word — language contract violation" };
  if (BANNED_OPENERS.some((o) => trimmed.startsWith(o))) return { ok: false, reason: "fell back to a banned fixed opener" };

  if (decision.mode === "ask") {
    if (!/[?？]$/.test(trimmed)) return { ok: false, reason: "mode=ask but does not end in a question mark" };
  }

  // §2/§1.C — the two banned patterns, checked for EVERY mode including
  // ask now (Conversation Question Quality Gate — previously skipped
  // for ask since that mode was unreachable; now that decideResponse
  // actually constructs it, a real question asking the user to confirm
  // HRI's own guess or explain a relationship is exactly the old
  // banned failure mode reappearing in a new branch, so it stays
  // banned unconditionally, not just for acknowledge*).
  const hypothesisHit = HYPOTHESIS_CONFIRM_MARKERS.find((m) => trimmed.includes(m));
  if (hypothesisHit) return { ok: false, reason: `banned hypothesis-confirmation pattern "${hypothesisHit}" — HRI must not assert its own guess and ask for confirmation` };
  const relationHit = RELATION_ANALYSIS_MARKERS.find((m) => trimmed.includes(m));
  if (relationHit) return { ok: false, reason: `banned relation-analysis-request pattern "${relationHit}" — HRI must not ask the user to analyze a relationship` };

  const ground = groundingText(decision);
  const presumptionHit = findUngroundedPresumption(trimmed, ground);
  if (presumptionHit) {
    return { ok: false, reason: `Restraint violation: ungrounded feeling/cause/desire-reframe marker "${presumptionHit}"` };
  }

  const groundingTokens = new Set<string>();
  for (const t of tokenSet(ground)) groundingTokens.add(t);
  const responseTokens = tokenSet(trimmed);
  const overlap = [...responseTokens].filter((t) => groundingTokens.has(t)).length;
  if (responseTokens.size >= 3 && overlap === 0) {
    return { ok: false, reason: "shares no content with its own grounding — possible invented content" };
  }

  return { ok: true };
}

export async function phraseResponse(
  decision: ResponseDecision,
  externalStats?: ResponseCallStat[],
): Promise<{ text: string | null; outcome: ResponseCallOutcome; errorMessage?: string }> {
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
    const validation = validatePhrasedResponse(content, decision);
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
