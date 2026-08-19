/**
 * Semantic Identity Reviewer Adapter — Sprint12-E4, extended
 * Sprint12-E5, restructured Sprint12-E6.
 *
 * Provider-specific code, isolated in this directory only, same rule as
 * semanticProviderAdapter.ts: nothing outside providers/ imports the
 * OpenAI API, and this file is never imported by controller.ts /
 * questionPlanner.ts / decisionGate.ts / reflectionComposer.ts /
 * understandingEngine.ts / observationPlanner.ts / types.ts /
 * validator.ts / evaluationHarness.ts (only identityReview.ts's
 * SemanticIdentityReviewer interface, which this file implements).
 *
 * Sprint12-E4 §3 — Generator/Reviewer separation: this uses the SAME
 * underlying model as semanticProviderAdapter.ts (gpt-4o-mini) but a
 * COMPLETELY SEPARATE system prompt with a narrower job. This Reviewer
 * is never told what identityRelation the Interpreter itself proposed
 * — only the target element's description, the candidate's own note/
 * groundingText, and the current turn text.
 *
 * Sprint12-E6 §8/§9 — architecture audit found Sprint12-E5's flat 4-way
 * choice (SAME_ELEMENT / SAME_REALITY_DIFFERENT_ELEMENT /
 * SEPARATE_REALITY / UNCERTAIN) gave UNCERTAIN no structural advantage
 * over the other three, and gave SAME_REALITY_DIFFERENT_ELEMENT the
 * weakest evidentiary bar of the three confident options (mere
 * "connection" vs. "IS the referent" or "NO real connection") — so it
 * became a safe escape hatch for both genuine uncertainty AND genuine
 * revisions. This adapter now asks two explicit, ordered questions in
 * ONE call (Option A — see report §C for why not a second call):
 * decidability first, identity only if decidable, with `decidability`
 * placed BEFORE `decision` in the output schema so the model reasons
 * about decidability before committing to a label (OpenAI structured
 * outputs generate fields in declared schema order).
 */
import type {
  IdentityReviewInput,
  IdentityReviewOutput,
  SemanticIdentityReviewer,
} from "../identityReview";

const MODEL = "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

export type ReviewCallOutcome = "SUCCESS" | "PARSE_ERROR" | "SCHEMA_ERROR" | "HTTP_ERROR";

export type ReviewCallStat = {
  turn: number;
  outcome: ReviewCallOutcome;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  errorMessage?: string;
};

const SYSTEM_PROMPT = `You are an independent Semantic Identity & Role Reviewer for a human reflection tool (HRI) context graph. You are NOT the same process that proposed the update below, and you do not generate context, questions, advice, or reflections.

You are given a candidate update that some other process wants to apply to an EXISTING context element ("the target"). Work through this in order.

STEP 1 — DECIDABILITY. Before deciding WHAT the relationship is, decide whether it CAN be decided from the evidence you actually have. Ask yourself:
- Could you justify picking one specific relationship without silently assuming something the user never actually said?
- Are there multiple genuinely different relationships this candidate could plausibly have with the target, with nothing in the text itself favoring one over the others?
- Does picking an answer require you to guess at a missing antecedent, a missing topic, or a missing reason that the text simply does not supply?
- If you had NOT been shown the target element at all, would the candidate's own wording already be specific enough to support your answer — or does your answer depend entirely on a target happening to be sitting right next to it?
If any of these point to real, unresolved ambiguity, decidability is NOT_DECIDABLE. This is not a measure of how hard the question feels or how confident you personally are — it is a measure of whether the EVIDENCE ITSELF settles the question. Being shown a target for comparison does not mean the comparison must have a definite answer; do not let the target's mere presence manufacture a sense of decidability the text doesn't earn. NOT_DECIDABLE is a correct, honest, ordinary answer whenever it genuinely applies — never avoid it just to appear more capable.

STEP 2 — IDENTITY (only meaningful if you said DECIDABLE — if NOT_DECIDABLE, still fill in your best lean below, but it will be discarded). Consider the possibilities in THIS order, and only move to the next one if the previous one genuinely does not fit — do not treat this as a flat menu to pick your favorite from:

(a) SAME_ELEMENT — ask FIRST: can the candidate be fully explained as the SAME underlying referent as the target, just continuing, clarifying, correcting, or REVISING it? A revision changes the state, priority, or direction of the same real-world matter over time (e.g. "I should go soon" → "actually, it can wait" is still about the same trip, just its urgency changing) — that is still SAME_ELEMENT, not a new element. A correction fixes what was said about the same matter. The wording, tense, or priority do not need to match the target — only the underlying referent does. If this explanation genuinely fits, use SAME_ELEMENT and STOP — do not keep looking at (b) just because a new-element reading is also logically possible. Prefer the explanation that keeps this as one evolving matter over one that invents a second matter, whenever both are honestly available.

(b) SAME_REALITY_DIFFERENT_ELEMENT — only consider this if (a) genuinely does not fit: is the candidate still part of the SAME specific ongoing episode/event/topic as the target — not merely related to it, but truly part of the same unfolding situation — while playing a distinct role in it (e.g. the target is a Direction and the candidate is actually a Constraint on that same direction)? Being mentioned near the target, by the same speaker, in the same conversation, or simply coexisting in this person's life right now is NOT sufficient by itself — relatedness is not sameness of episode. Only use this when the candidate's own content ties it to the SAME specific event/topic as the target.

(c) SEPARATE_REALITY — use this if the candidate is not part of the same episode/topic as the target at all, even if it coexists with it in this person's life right now.

STEP 3 — RELATION (only for SAME_REALITY_DIFFERENT_ELEMENT). You may suggest a relation type between the new element and the target — one of: limits, supports, conflictsWith, respondsTo, clarifies, revises, relatesTo — but ONLY if the text gives you real grounds for something more specific than a generic connection. If unsure, use 'none' (a generic connection is always safe to assume; a specific one is not).

Judge by meaning, not by shared words: a genuine SAME_ELEMENT continuation or revision can use completely different vocabulary from the target; two genuinely different topics can share vocabulary. Do not apply fixed keyword/domain categories (e.g. do not treat "work" vs "friend" vs "health" as an automatic separate-topic rule, and do not treat any specific word as automatically meaning "constraint" or any other role, and do not treat sentence length or the presence of a pronoun by itself as automatically meaning NOT_DECIDABLE) — judge the actual semantic role and connection from meaning alone, case by case.

Return ONLY the structured JSON matching the given schema, filling the fields in the order they are given — reason about decidability before you commit to an identity label.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    decidability: {
      type: "string",
      enum: ["DECIDABLE", "NOT_DECIDABLE"],
      description: "Can the identity relationship be justified from the evidence alone, without assuming anything unstated? See STEP 1.",
    },
    decidabilityReason: { type: "string", description: "One short sentence: why is this decidable or not, from the evidence itself." },
    decision: {
      type: "string",
      enum: ["SAME_ELEMENT", "SAME_REALITY_DIFFERENT_ELEMENT", "SEPARATE_REALITY"],
      description: "Only meaningful when decidability is DECIDABLE — it is discarded otherwise. Still fill in your best lean even if NOT_DECIDABLE, rather than leaving this incomplete. See STEP 2's priority order.",
    },
    confidence: { type: "number", description: "0 to 1. Observational only — genuine uncertainty, not always high." },
    note: { type: "string", description: "One short sentence explaining the decision, for human debugging only." },
    suggestedRelationType: {
      type: "string",
      enum: ["limits", "supports", "conflictsWith", "respondsTo", "clarifies", "revises", "relatesTo", "none"],
      description: "Only meaningful when decision is SAME_REALITY_DIFFERENT_ELEMENT. Use 'none' if you have no specific grounds beyond a generic connection.",
    },
  },
  required: ["decidability", "decidabilityReason", "decision", "confidence", "note", "suggestedRelationType"],
  additionalProperties: false,
} as const;

function buildUserPrompt(input: IdentityReviewInput): string {
  const nearbyText = input.nearbyActiveElements.length
    ? input.nearbyActiveElements.map((e) => `- id=${e.id} kind=${e.kind} description="${e.description}"`).join("\n")
    : "(none)";

  return `Current turn (turn ${input.currentTurn}): "${input.currentTurnText}"

Target element proposed for update:
- id=${input.candidateUpdate.targetElementId}
- kind=${input.targetElement.kind}
- current description="${input.targetElement.description}"

Candidate update's own note: "${input.candidateUpdate.note}"
Candidate update's grounding quote (turn ${input.candidateUpdate.groundingTurn}): "${input.candidateUpdate.groundingText}"

Other currently active elements (context only — you are judging ONLY the relationship between the candidate and the target above, not whether it matches one of these instead):
${nearbyText}

Work through STEP 1 (decidability) then STEP 2 (identity, if decidable) for the candidate update above.`;
}

type RawReview = { decidability: string; decidabilityReason: string; decision: string; confidence: number; note: string; suggestedRelationType: string };
const DECIDABILITY_VALUES = new Set(["DECIDABLE", "NOT_DECIDABLE"]);
const DECISIONS = new Set(["SAME_ELEMENT", "SAME_REALITY_DIFFERENT_ELEMENT", "SEPARATE_REALITY"]);
const RELATION_TYPES_OR_NONE = new Set(["limits", "supports", "conflictsWith", "respondsTo", "clarifies", "revises", "relatesTo", "none"]);

function isValidRawReview(x: unknown): x is RawReview {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.decidability === "string" && DECIDABILITY_VALUES.has(o.decidability) &&
    typeof o.decidabilityReason === "string" &&
    typeof o.decision === "string" && DECISIONS.has(o.decision) &&
    typeof o.confidence === "number" &&
    typeof o.note === "string" &&
    typeof o.suggestedRelationType === "string" && RELATION_TYPES_OR_NONE.has(o.suggestedRelationType)
  );
}

/**
 * Fallback on ANY failure (missing key, HTTP error, parse/schema
 * failure) is NOT_DECIDABLE, never a confident decision (Sprint12-E4
 * §11/§18, Sprint12-E6 §11): we have no basis for an assertive
 * judgment at all.
 */
function fallbackNotDecidable(note: string): IdentityReviewOutput {
  return { decidability: "NOT_DECIDABLE", confidence: 0, note };
}

export function createSemanticIdentityReviewerAdapter(externalStats?: ReviewCallStat[]): { reviewer: SemanticIdentityReviewer; stats: ReviewCallStat[] } {
  const stats: ReviewCallStat[] = externalStats ?? [];
  const apiKey = process.env.OPENAI_API_KEY;

  const reviewer: SemanticIdentityReviewer = {
    async review(input: IdentityReviewInput): Promise<IdentityReviewOutput> {
      if (!apiKey) {
        stats.push({ turn: input.currentTurn, outcome: "HTTP_ERROR", latencyMs: 0, errorMessage: "OPENAI_API_KEY not set" });
        return fallbackNotDecidable("OPENAI_API_KEY not set");
      }

      const start = Date.now();
      let res: Response;
      try {
        res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: buildUserPrompt(input) },
            ],
            response_format: { type: "json_schema", json_schema: { name: "identity_review", strict: true, schema: OUTPUT_SCHEMA } },
            temperature: 0,
          }),
        });
      } catch (err) {
        stats.push({ turn: input.currentTurn, outcome: "HTTP_ERROR", latencyMs: Date.now() - start, errorMessage: String(err) });
        return fallbackNotDecidable("HTTP request failed");
      }
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        stats.push({ turn: input.currentTurn, outcome: "HTTP_ERROR", latencyMs, errorMessage: `HTTP ${res.status}: ${bodyText.slice(0, 300)}` });
        return fallbackNotDecidable(`HTTP ${res.status}`);
      }

      const body = await res.json().catch(() => undefined);
      const usage = body?.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
      const content: string | undefined = body?.choices?.[0]?.message?.content;

      if (!content) {
        stats.push({ turn: input.currentTurn, outcome: "PARSE_ERROR", latencyMs, errorMessage: "no content in response", inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens });
        return fallbackNotDecidable("no content in provider response");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        stats.push({ turn: input.currentTurn, outcome: "PARSE_ERROR", latencyMs, errorMessage: String(err), inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens });
        return fallbackNotDecidable("JSON.parse failed on provider content");
      }

      if (!isValidRawReview(parsed)) {
        stats.push({ turn: input.currentTurn, outcome: "SCHEMA_ERROR", latencyMs, errorMessage: "shape check failed", inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens });
        return fallbackNotDecidable("provider output failed shape validation");
      }

      stats.push({ turn: input.currentTurn, outcome: "SUCCESS", latencyMs, inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens });
      const decidability = parsed.decidability as IdentityReviewOutput["decidability"];
      return {
        decidability,
        // Sprint12-E6 §10 invariant enforced HERE, structurally: the raw
        // wire format always carries some `decision` value (strict JSON
        // schema requires it), but it is only ever exposed when the
        // Reviewer itself said DECIDABLE — never trust it otherwise.
        decision: decidability === "DECIDABLE" ? (parsed.decision as IdentityReviewOutput["decision"]) : undefined,
        confidence: parsed.confidence,
        note: parsed.note,
        suggestedRelationType: parsed.suggestedRelationType === "none" ? undefined : (parsed.suggestedRelationType as IdentityReviewOutput["suggestedRelationType"]),
      };
    },
  };

  return { reviewer, stats };
}
