/**
 * Gate 31 — AURINA Final Experience Phraser.
 *
 * A SEPARATE, narrow LLM call, same isolation principle as
 * responsePhraser.ts/questionPhraser.ts: this call's ONLY input is the
 * deterministic FinalExperienceGrounding (finalExperienceComposer.ts) —
 * it never decides WHAT is groundable, only HOW to express it across
 * the session's two closing layers. Every output is structurally
 * validated (validateFinalExperience) before use; any failure falls
 * back to the deterministic renderer (renderFinalExperienceTemplate).
 *
 * Single combined call (not two separate calls for mirror/sharing):
 * same reasoning contextFirstSemanticAdapter.ts gives for its own
 * single-call design (see that file's header, "Option A... why not a
 * second call") — both layers read the SAME grounding, and this
 * request already sits at the end of a per-turn chain that (per Gate 31
 * investigation §13) can already involve several sequential provider
 * calls across a replayed session; a second round trip here would only
 * add latency without adding groundable material.
 */
import type { FinalExperienceGrounding, FinalExperienceResult } from "./finalExperienceTypes";

const MODEL = "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

export type FinalExperienceCallOutcome = "SUCCESS" | "SKIPPED" | "TECHNICAL_FAILURE" | "VALIDATION_FAILURE";
export type FinalExperienceCallStat = { outcome: FinalExperienceCallOutcome; latencyMs: number; errorMessage?: string };

const SYSTEM_PROMPT = `You are producing AURINA's Final Experience — the closing screen of a human reflection tool, shown once at the end of a session. It has exactly two layers, written in Korean:

LAYER 1 — "마음의 거울" (Empathic Reflection). NOT a list of what the user said, in order, connected by words like "먼저/이어/그리고". Instead, synthesize the CURRENT STATE OF MIND that this session's material actually shows: what's present, whether it moved or shifted during the session, and any tension or contrast — but ONLY if the grounding material actually contains one (a "tension" field marked true, or an explicit relation of type conflictsWith/limits). Allowed phrasing: "~로 보입니다", "~했던 것 같습니다", "~에 가까워진 듯합니다", and similar grounded-abstraction language. The test for every sentence you write here: is there real conversation material backing this, even loosely? If not, cut it.

LAYER 2 — "마음이 머무는 곳" (Human Sharing). NOT more analysis. This is AURINA staying with the user's mind for a moment, the way one person sits with another's experience. You may use warmth, quiet comfort, genuine empathy, a connection to universal human experience, gentle quiet critique of a real tension the user's own words showed (never a judgment of their character or a diagnosis), and modest literary phrasing. You may generalize from the user's specific grounded experience to a broader truth about being human — but you must ANCHOR that generalization in the user's own specific words FIRST, never open with an abstract claim about people in general. For example, if the grounding shows "쉬는 게 가장 좋지만 시간적 여유가 없다" + "여유를 찾아야 제대로 생각이 정리될 것 같다", a specific opening reads like "쉬고 싶다는 마음과 쉴 수 없다는 현실이 계속 부딪히고 있습니다." — starting from the exact tension itself. Only after that specific anchor may you widen out toward something true about people generally, if it earns its place. That is not fabricating a fact about this specific user; it is connecting their real, stated experience to something true about people in general — but it is never the OPENING move. What you may NEVER do: invent a new specific event, name, number, or claimed emotion the grounding does not support: never write a direct quote in quotation marks unless it is a literal substring of the grounding given to you.

BANNED — checked structurally, not just here, because these became the default under repetition:
- Opening the piece with a generic-subject sentence: "사람은", "인간은", "우리는 종종", "우리는 때때로", "많은 사람들은/에게", "누구에게나", or any similarly abstract subject as the FIRST sentence. Start from the specific content instead — see the example above.
- Using a universalizing crutch phrase ANYWHERE in the piece, not just as an opener: "누구에게나", "누구나 겪는", "모두가 겪는", "모두가 느끼는", "우리 모두는". Real, earned language about shared human experience is still welcome (Layer 2's whole point) — these specific worn phrases are what to avoid, not the idea itself.
- Closing the piece with a reflexive moral/advice/soft-hope tag: "~하기를 바랍니다", "~기원합니다", "~것이 중요합니다"/"~중요한 일입니다"/"~중요할지도 모릅니다", "~필요합니다"/"~필요한 일입니다"/"~필요할지도 모릅니다", "~잊지 마세요"/"~잊지 말아야", "~하는 것도 좋습니다", "~소중합니다". If your last sentence could be pasted onto any other session's ending unchanged, it is too generic — let the piece simply stop when it has said its real thing, without appending a moral or a wish.
- Giving direct advice or an instruction to act ("~해보세요", "~하는 것도 좋습니다", "~돌보세요") — AURINA witnesses, she does not coach.

CRITICAL — vary the shape and mood every time, driven only by what THIS session's grounding actually contains:
- Do not resolve every session into comfort. Do not always end hopeful. Do not always say some version of "괜찮다". Do not always manufacture a life lesson or moral. Some sessions should end quietly, some plainly, some with an unresolved or slightly uncomfortable truth left standing — let the material decide, not a habit.
- Judge tension from the actual verbatim words and elements given to you, not only the "tension detected" boolean below — that flag is a narrow structural signal (an explicit conflictsWith/limits relation, or a lexical marker like "하지만") and can miss real tension your own reading of the words can see (e.g. wanting to say something and holding it back, frustration, suppressed reaction, a contradiction between what's felt and what's done). When you sense real tension in the words themselves — whether or not the flag is true — your default should lean toward the quiet-critique register, not toward comfort: gently naming the real tension AS IT STANDS, without resolving it into something fine. Reserve warmth/hope for grounding that actually earns it (contentment, relief, forward motion already present in the user's own words) rather than applying it as a default coping wrapper for every kind of content.
- Never write a call-to-action to return or talk again (no "또 만나요", "다시 이야기해요", "언제든 다시 찾아주세요", or similar). If the user wants to come back, that has to be because the writing itself was worth reading, not because you asked them to.
- Never use the two banned patterns from AURINA's per-turn Response layer either: never assert your own guess about a connection and ask the user to confirm it, and never ask the user a question at all here — this is a closing statement, not a prompt for more input.
- Layer 2 can be noticeably longer and more expressive than Layer 1 (Layer 1 is measured and grounded; Layer 2 is where AURINA is allowed real voice) but must still trace back to real grounding, not a generic template that could be pasted onto any session unchanged.

Other rules:
1. Write ONLY in Korean.
2. Return ONLY the two fields the schema asks for — no extra commentary.
3. If unresolvedReasons is non-empty, it is fine (often better) to let Layer 1 or 2 leave that honestly open rather than resolving it.`;

/** Appended to the user prompt only on the one style-driven retry
 *  (see phraseFinalExperience) — names exactly what the first attempt
 *  did wrong so the retry has a real chance of actually varying,
 *  instead of resampling the same habit at the same temperature. */
function buildRetryNudge(reason: string): string {
  return `\n\nYour previous attempt for LAYER 2 failed this specific check: ${reason}. Write it again, genuinely differently this time — a different opening, a different closing, anchored in the specific content, not the generic pattern you just used.`;
}

const RAW_SCHEMA = {
  type: "object",
  properties: {
    mirror: { type: "string", description: "Layer 1 — 마음의 거울. Empathic, grounded-abstraction synthesis. Korean." },
    sharing: { type: "string", description: "Layer 2 — 마음이 머무는 곳. Human Sharing. Korean." },
  },
  required: ["mirror", "sharing"],
  additionalProperties: false,
} as const;

function buildUserPrompt(grounding: FinalExperienceGrounding, retryNudge?: string): string {
  const elementsText = grounding.elements.length
    ? grounding.elements.map((e) => `- [${e.kind}] ${e.description} (status=${e.status}, confidence=${e.confidence})`).join("\n")
    : "(none)";
  const relationsText = grounding.relations.length
    ? grounding.relations.map((r) => `- ${r.fromDescription} --${r.type}--> ${r.toDescription}`).join("\n")
    : "(none)";
  const unresolvedText = grounding.unresolvedReasons.length
    ? grounding.unresolvedReasons.map((r) => `- ${r}`).join("\n")
    : "(none)";
  const verbatimText = grounding.verbatimEvidence.length
    ? grounding.verbatimEvidence.map((v) => `- "${v}"`).join("\n")
    : "(none)";

  return `session turn count: ${grounding.turnCount}
tension detected (grounded signal only, not a suggestion to invent one): ${grounding.hasTension}

Verbatim things the user actually said this session (the ultimate ground truth):
${verbatimText}

Understanding elements formed from that (already grounding-validated, richer than raw quotes but never inventing beyond them):
${elementsText}

Relations between those elements:
${relationsText}

Points the session left genuinely unresolved:
${unresolvedText}

Write LAYER 1 (mirror) and LAYER 2 (sharing) now, per the system instructions.${retryNudge ?? ""}`;
}

const MAX_MIRROR_LEN = 260;
const MAX_SHARING_LEN = 520;
const OLD_FIXED_ENDING_MARKERS = ["하나의 흐름으로 바라보기 시작했습니다", "흐름을 이해하는 것은 끝이 아니라 시작"];
const REVISIT_CTA_MARKERS = ["또 만나요", "다시 만나요", "또 이야기해", "다시 찾아주세요", "언제든 다시", "또 뵐게요", "다시 뵐게요"];
const ENUMERATION_MARKERS = ["먼저 '", "이어 '", "그리고 '"];

/**
 * Content-quality style checks (Final Content Quality Gate) — soft,
 * not safety. Confirmed empirically: 7/8 real CASE runs opened
 * sharing with a generic-subject sentence and 8/8 closed with a
 * reflexive moral/hope tag (see scratch_failure_analysis.md this
 * Gate). Kept structurally SEPARATE from validateFinalExperience's
 * hard safety checks below — a style miss triggers one retry
 * (phraseFinalExperience), never an immediate fallback to the bland
 * template. Regressing to that template for a style reason is exactly
 * what this Gate's instructions forbid ("안전성을 이유로 다시 단순
 * 의역·상투적 위로로 후퇴시키지 않는다").
 */
const GENERIC_OPENER_MARKERS = ["사람은", "인간은", "우리는 종종", "우리는 때때로", "때때로 우리는", "많은 사람들", "많은 사람에게", "누구에게나"];
const GENERIC_CLOSER_MARKERS = [
  "하기를 바랍니다", "기를 바랍니다", "기원합니다",
  "중요합니다", "중요한 일입니다", "중요할지도 모릅니다",
  "필요합니다", "필요한 일입니다", "필요할지도 모릅니다",
  "잊지 마세요", "잊지 말아야",
  "하는 것도 좋습니다", "해보는 것도 좋습니다",
  "정말 소중합니다", "소중합니다",
];
/** Round 2 (still driven by real CASE output, not guessing): after the
 *  opener/closer fix above, "누구에게나"/"모두가 겪는" etc. emerged as
 *  the model's new universalizing crutch — 5/8 real re-runs used it,
 *  usually mid-sentence rather than as the sentence-opener the first
 *  round's check catches. Checked ANYWHERE in the text, not just a
 *  position, because the repetition itself (not where it sits) is the
 *  problem — genuine "우리"/"사람들" language earned by real content is
 *  NOT banned wholesale (Gate goal 3 explicitly protects that), only
 *  this specific small set of observed crutch phrases. */
const GENERIC_MIDTEXT_MARKERS = ["누구에게나", "누구나 겪는", "모두가 겪는", "모두가 느끼는", "우리 모두는"];

/** Round 3: the round-2 re-run showed GENERIC_OPENER_MARKERS entries
 *  ("우리는 종종", "많은 사람들") reappearing mid-sentence instead of at
 *  the very start — a startsWith-only check is trivially evaded just by
 *  moving the same crutch phrase one clause later. Both lists are now
 *  scanned the same way, anywhere in the text; GENERIC_OPENER_MARKERS
 *  is kept as its own list only because the system prompt still tells
 *  the model specifically not to OPEN with these. */
function checkSharingStyle(sharing: string): string | null {
  const trimmed = sharing.trim();
  const openerHit = [...GENERIC_OPENER_MARKERS, ...GENERIC_MIDTEXT_MARKERS].find((m) => trimmed.includes(m));
  if (openerHit) return `sharing uses a generic/universalizing crutch phrase: "${openerHit}"`;

  const strippedEnd = trimmed.replace(/[.!?。！？\s]+$/g, "");
  const closerHit = GENERIC_CLOSER_MARKERS.find((m) => strippedEnd.endsWith(m));
  if (closerHit) return `sharing closes with a generic moral/advice pattern: "${closerHit}"`;

  return null;
}

function extractQuotedSpans(text: string): string[] {
  const spans: string[] = [];
  const re = /['"“‘]([^'"”’]{2,})['"”’]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) spans.push(m[1]);
  return spans;
}

function findFabricatedQuote(text: string, grounding: FinalExperienceGrounding): string | null {
  const corpus = [...grounding.verbatimEvidence, ...grounding.elements.map((e) => e.description)].join(" ");
  for (const span of extractQuotedSpans(text)) {
    if (!corpus.includes(span)) return span;
  }
  return null;
}

function basicTextCheck(field: "mirror" | "sharing", text: string, maxLen: number): { ok: true } | { ok: false; reason: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: `${field} empty` };
  if (trimmed.length > maxLen) return { ok: false, reason: `${field} too long (${trimmed.length} chars)` };
  if (!/[가-힣]/.test(trimmed)) return { ok: false, reason: `${field} contains no Hangul` };
  if (/[A-Za-z]{3,}/.test(trimmed)) return { ok: false, reason: `${field} contains an English word — language contract violation` };
  if (/[?？]\s*$/.test(trimmed)) return { ok: false, reason: `${field} ends in a question — Final Experience must never prompt for more input` };
  return { ok: true };
}

export function validateFinalExperience(
  raw: { mirror?: unknown; sharing?: unknown },
  grounding: FinalExperienceGrounding,
): { ok: true; value: FinalExperienceResult } | { ok: false; reason: string } {
  if (typeof raw.mirror !== "string" || typeof raw.sharing !== "string") {
    return { ok: false, reason: "mirror/sharing not both strings" };
  }
  const mirror = raw.mirror.trim();
  const sharing = raw.sharing.trim();

  const mirrorCheck = basicTextCheck("mirror", mirror, MAX_MIRROR_LEN);
  if (!mirrorCheck.ok) return mirrorCheck;
  const sharingCheck = basicTextCheck("sharing", sharing, MAX_SHARING_LEN);
  if (!sharingCheck.ok) return sharingCheck;

  // Found in real CASE C output: basicTextCheck's own [?？]\s*$ check only
  // catches a question mark at the very END of the string, so a
  // mid-paragraph question ("...어떤 의미일까요? 그 갈망이...") passed
  // validation undetected. The Gift Card is a closing statement, never a
  // prompt for more input, anywhere in it — so sharing (not mirror, which
  // keeps its existing end-only check unchanged) is scanned for a
  // question mark ANYWHERE in the string, not just at the end.
  if (/[?？]/.test(sharing)) {
    return { ok: false, reason: "sharing contains a question mark somewhere in the text — the Gift Card must never ask the user anything" };
  }

  const enumHit = ENUMERATION_MARKERS.filter((m) => mirror.includes(m));
  if (enumHit.length >= 2) {
    return { ok: false, reason: `mirror regressed to sequence-enumeration pattern (${enumHit.join(", ")})` };
  }

  const oldEndingHit = [...OLD_FIXED_ENDING_MARKERS].find((m) => mirror.includes(m) || sharing.includes(m));
  if (oldEndingHit) return { ok: false, reason: `contains the retired fixed closing line: "${oldEndingHit}"` };

  const ctaHit = REVISIT_CTA_MARKERS.find((m) => sharing.includes(m));
  if (ctaHit) return { ok: false, reason: `sharing contains a revisit call-to-action: "${ctaHit}"` };

  const fabricatedMirror = findFabricatedQuote(mirror, grounding);
  if (fabricatedMirror) return { ok: false, reason: `mirror quotes "${fabricatedMirror}" which is not in the grounding` };
  const fabricatedSharing = findFabricatedQuote(sharing, grounding);
  if (fabricatedSharing) return { ok: false, reason: `sharing quotes "${fabricatedSharing}" which is not in the grounding` };

  return { ok: true, value: { mirror, sharing } };
}

type ProviderCallResult =
  | { ok: true; value: FinalExperienceResult; latencyMs: number }
  | { ok: false; outcome: FinalExperienceCallOutcome; errorMessage: string; latencyMs: number };

/** One raw provider call + hard-safety validation only — no retry, no
 *  style checks. phraseFinalExperience below is the only place that
 *  decides whether/how to retry. */
async function callProvider(
  apiKey: string,
  grounding: FinalExperienceGrounding,
  retryNudge: string | undefined,
): Promise<ProviderCallResult> {
  const start = Date.now();
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(grounding, retryNudge) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "final_experience", strict: true, schema: RAW_SCHEMA } },
        temperature: 0.6,
      }),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      return { ok: false, outcome: "TECHNICAL_FAILURE", errorMessage: `HTTP ${res.status}: ${bodyText.slice(0, 200)}`, latencyMs };
    }
    const body = await res.json().catch(() => undefined);
    const content: string | undefined = body?.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, outcome: "TECHNICAL_FAILURE", errorMessage: "no content in provider response", latencyMs };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      return { ok: false, outcome: "TECHNICAL_FAILURE", errorMessage: `JSON.parse failed: ${String(err)}`, latencyMs };
    }
    const validation = validateFinalExperience(parsed as { mirror?: unknown; sharing?: unknown }, grounding);
    if (!validation.ok) {
      return { ok: false, outcome: "VALIDATION_FAILURE", errorMessage: validation.reason, latencyMs };
    }
    return { ok: true, value: validation.value, latencyMs };
  } catch (err) {
    return { ok: false, outcome: "TECHNICAL_FAILURE", errorMessage: String(err), latencyMs: Date.now() - start };
  }
}

export async function phraseFinalExperience(
  grounding: FinalExperienceGrounding,
  externalStats?: FinalExperienceCallStat[],
): Promise<{ result: FinalExperienceResult | null; outcome: FinalExperienceCallOutcome; errorMessage?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    externalStats?.push({ outcome: "SKIPPED", latencyMs: 0, errorMessage: "OPENAI_API_KEY not set" });
    return { result: null, outcome: "SKIPPED", errorMessage: "OPENAI_API_KEY not set" };
  }

  const first = await callProvider(apiKey, grounding, undefined);
  if (!first.ok) {
    // Hard safety/technical failure — unchanged behavior, straight to
    // the deterministic fallback. Never retried: a retry cannot fix a
    // fabrication or a technical error, only style.
    externalStats?.push({ outcome: first.outcome, latencyMs: first.latencyMs, errorMessage: first.errorMessage });
    return { result: null, outcome: first.outcome, errorMessage: first.errorMessage };
  }

  const styleIssue = checkSharingStyle(first.value.sharing);
  if (!styleIssue) {
    externalStats?.push({ outcome: "SUCCESS", latencyMs: first.latencyMs });
    return { result: first.value, outcome: "SUCCESS" };
  }

  // Style-only issue (Final Content Quality Gate) — one retry with a
  // concrete nudge naming what to avoid, never an immediate fallback:
  // regressing to the generic template for a style reason is exactly
  // what this Gate forbids.
  const retry = await callProvider(apiKey, grounding, buildRetryNudge(styleIssue));
  if (!retry.ok) {
    // The retry hit a genuine hard-safety issue this time — that DOES
    // still go to the fallback, same as first.ok===false above.
    externalStats?.push({ outcome: retry.outcome, latencyMs: first.latencyMs + retry.latencyMs, errorMessage: `retry after style issue "${styleIssue}" also failed: ${retry.errorMessage}` });
    return { result: null, outcome: retry.outcome, errorMessage: retry.errorMessage };
  }

  // Retry passed hard safety. Whether or not it still trips the style
  // check, it is real, safety-checked AURINA content — accepted either
  // way, per this Gate's explicit priority over a second-guessed
  // template fallback. The outcome value still distinguishes the two
  // cases for audit (devLog/observability), not for behavior.
  const stillGeneric = checkSharingStyle(retry.value.sharing);
  externalStats?.push({
    outcome: "SUCCESS",
    latencyMs: first.latencyMs + retry.latencyMs,
    errorMessage: stillGeneric ? `accepted after 1 retry, style still generic: ${stillGeneric}` : `accepted after 1 retry, fixed: ${styleIssue}`,
  });
  return { result: retry.value, outcome: "SUCCESS" };
}

/**
 * Deterministic fallback — always available when the provider is
 * unavailable or its output fails validation. Deliberately plain and
 * honest rather than poetic (Gate 31 §7 rejects a fixed poetic ending
 * as the default; a degraded path should read as a safe placeholder,
 * not as HRI's real Final Experience voice).
 */
export function renderFinalExperienceTemplate(grounding: FinalExperienceGrounding): FinalExperienceResult {
  const mirror = grounding.verbatimEvidence.length
    ? `지금까지 남기신 말씀 속에서 현재의 흐름이 조금씩 드러나고 있는 것으로 보입니다.`
    : `아직은 마음의 방향을 단정하기보다, 지금 남아 있는 것을 그대로 두는 단계에 가깝습니다.`;
  const sharing = `지금 이 흐름은 아직 완전히 정리된 형태는 아니지만, 있는 그대로도 충분히 의미가 있습니다.`;
  return { mirror, sharing };
}
