/**
 * Semantic Provider Adapter — Sprint12-E.
 *
 * Provider-specific code, isolated in this directory only (Sprint12-E
 * §5). Nothing outside src/lib/hri/context/providers/ imports the
 * OpenAI API, and this file is never imported by controller.ts /
 * questionPlanner.ts / decisionGate.ts / reflectionComposer.ts /
 * understandingEngine.ts / observationPlanner.ts / types.ts /
 * validator.ts.
 *
 * No SDK dependency added — the project has no AI provider SDK
 * installed (see Sprint12-E Gate report section B), and this Sprint's
 * own instructions say not to install one for this. Node's native
 * `fetch` (available since Node 18, this project runs on Node 24) is
 * used to call OpenAI's REST API directly.
 *
 * Contract discipline: interpret() NEVER returns the raw provider
 * response. Every call goes through
 *   raw HTTP response -> JSON.parse -> shape/schema check -> InterpreterOutput
 * and a parse or schema failure produces a documented PARSE_ERROR /
 * SCHEMA_ERROR outcome (recorded in stats, surfaced as an empty,
 * all-REJECTable output) rather than being silently patched into
 * something that looks valid.
 */
import type {
  ContextGraphSummary,
  IdentityRelation,
  InterpreterInput,
  InterpreterOutput,
  PreviousProposalFeedback,
  ProposedElement,
  ProposedRelation,
  ProposedUnresolved,
  ProposedUpdate,
  SemanticContextInterpreter,
} from "../types";

const MODEL = "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

export type ProviderCallOutcome = "SUCCESS" | "PARSE_ERROR" | "SCHEMA_ERROR" | "HTTP_ERROR";

export type ProviderCallStat = {
  turn: number;
  outcome: ProviderCallOutcome;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  errorMessage?: string;
};

const RAW_ITEM_COMMON = {
  groundingQuote: { type: "string", description: "A literal substring of the turn text this proposal is grounded in." },
  groundingTurn: { type: "number", description: "The exact turn number (from the 'recentTurns' you were given) that groundingQuote is a substring of. This MUST be the LATEST turn number in recentTurns — the reason this proposal exists at all is something said in that latest turn. Do NOT cite an earlier turn here even if it feels more relevant; if you need to connect this proposal to something said earlier, do that through targetElementId (for updates) or the relation's from/to (for relations) — never by re-citing old text as this proposal's own trigger evidence." },
  confidence: { type: "number", description: "0 to 1. Genuine uncertainty, not always high." },
} as const;

const IDENTITY_RELATION_DESCRIPTION =
  "Your own judgment of why this update is about the SAME referent as targetElementId: 'continuation' = plainly the same ongoing fact, this is just more evidence for it; 'clarification' = same fact, now stated more specifically; 'revision' = the fact itself changed, was corrected, or was de-emphasized; 'uncertainSameElement' = you are not fully confident this new turn is really about the same referent as targetElementId. Prefer 'uncertainSameElement' over forcing a confident label the text doesn't support — do not default to 'continuation' just because targetElementId was the most recently discussed element.";

const IMPLIED_ELEMENT_KIND_DESCRIPTION =
  "If this update turns out NOT to be the same element as targetElementId after all (an independent review checks this), what ElementKind would this content be as its OWN, independent element? Always answer this, even when you are confident it IS the same element — e.g. if targetElementId is a direction about a trip and this update's own content is actually about something blocking that trip, answer 'constraint' here even though you proposed it as an update to the direction.";

const RAW_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    newElements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          localRef: { type: "string", description: "Short fresh handle for this NEW element, e.g. 'new-1'. Never an existing id." },
          kind: { type: "string", enum: ["situation", "direction", "constraint", "response"] },
          description: { type: "string" },
          ...RAW_ITEM_COMMON,
        },
        required: ["localRef", "kind", "description", "groundingQuote", "groundingTurn", "confidence"],
        additionalProperties: false,
      },
    },
    updatedElements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          targetElementId: { type: "string", description: "MUST be an existing id from activeContext.elements — never invented." },
          kind: { type: "string", enum: ["reinforce", "specify", "revise", "conflict", "deprioritize", "resolve"] },
          identityRelation: { type: "string", enum: ["continuation", "clarification", "revision", "uncertainSameElement"], description: IDENTITY_RELATION_DESCRIPTION },
          impliedElementKind: { type: "string", enum: ["situation", "direction", "constraint", "response"], description: IMPLIED_ELEMENT_KIND_DESCRIPTION },
          note: { type: "string" },
          ...RAW_ITEM_COMMON,
        },
        required: ["targetElementId", "kind", "identityRelation", "impliedElementKind", "note", "groundingQuote", "groundingTurn", "confidence"],
        additionalProperties: false,
      },
    },
    relations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["limits", "supports", "conflictsWith", "respondsTo", "clarifies", "revises", "relatesTo"] },
          from: { type: "string", description: "Existing element id, or a localRef from newElements in this same response." },
          to: { type: "string" },
          ...RAW_ITEM_COMMON,
        },
        required: ["type", "from", "to", "groundingQuote", "groundingTurn", "confidence"],
        additionalProperties: false,
      },
    },
    unresolvedCandidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          existingUnresolvedId: {
            type: "string",
            description: "If this is about the SAME open question as one already listed in 'Currently unresolved' below, put its exact id here. Otherwise use 'none'. This updates that existing point instead of creating a duplicate — never guess an id that wasn't shown to you.",
          },
          relatesTo: { type: "array", items: { type: "string" } },
          reason: { type: "string", description: "A descriptive sentence. Never a question." },
          groundingQuote: { type: "string" },
          groundingTurn: { type: "number", description: "The exact turn number that groundingQuote is a substring of." },
          uncertainty: { type: "number" },
          potentialInformationGain: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["existingUnresolvedId", "relatesTo", "reason", "groundingQuote", "groundingTurn", "uncertainty", "potentialInformationGain"],
        additionalProperties: false,
      },
    },
    confidence: { type: "number" },
    uncertaintyNotes: { type: "array", items: { type: "string" } },
  },
  required: ["newElements", "updatedElements", "relations", "unresolvedCandidates", "confidence", "uncertaintyNotes"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are a Grounded Context Interpreter for a human reflection tool (HRI). You are NOT a conversational assistant.

Your ONLY job: read the user's recent turns and the current context graph, and propose structured updates to that graph. You never generate a question, advice, reflection, or any text meant for the user to read.

Element kinds (exactly these 4, never invent new ones):
- situation: something that is the case (an event, state, or condition).
- direction: something the user wants, intends, or leans toward.
- constraint: something that limits or blocks a direction/situation.
- response: an emotional/cognitive/behavioral reaction.

Relation types (exactly these 7): limits, supports, conflictsWith, respondsTo, clarifies, revises, relatesTo.

Rules you must follow:
0. Write every "description", "note", "reason", and "groundingQuote" in the SAME language as the source turns (if the user writes in Korean, your description/groundingQuote must also be in Korean — never translate).
1. Every element/update/relation needs a "groundingQuote" — a literal substring actually present in the turns you were given. Never invent facts not in the text ("common sense" completions are forbidden).
2. When updating or relating to an EXISTING element, you MUST use its real id exactly as given in activeContext.elements[].id. Never guess or paraphrase an id.
3. Only propose a "conflictsWith" or "limits" relation when there is real evidence of an actual constraint/conflict — never just because two elements happen to coexist.
4. Preserve negation exactly as stated ("I don't want to go back" must never become a positive desire to go back).
5. If a reference is ambiguous ("that thing", "그게", "그 일") and you cannot confidently resolve it from the given text, do NOT force it into a confident element — prefer a low-confidence element or an unresolvedCandidate instead.
6. Two or more directions can coexist without contradiction — do not silently overwrite one with another.
7. When new text revises, corrects, or de-emphasizes something already in activeContext, propose it as an update (kind: revise/specify/deprioritize/conflict) referencing the existing id — never silently duplicate it as an unrelated new element, and never delete/ignore the old one.
8. confidence must reflect genuine uncertainty (not always near 1.0).
9. Every update also needs identityRelation, your own judgment of whether the new turn is really about the same referent as targetElementId (see its schema description). Do not default to "continuation" just because targetElementId happens to be the most recently active element — if the new turn is actually a different fact that merely coexists with it (e.g. a different person, a different topic), propose a NEW element instead, optionally with a "relatesTo" relation to the existing one, rather than forcing it in as an update.
10. Every groundingTurn (on newElements, updatedElements, and relations) MUST be the LATEST turn number in recentTurns — never an earlier one. See groundingTurn's own schema description for why.
11. If you are given "Previous turn's proposal outcome" with a REJECTED list, those ids/refs were NOT accepted into the context graph — they do not exist. Never target them with updatedElements.targetElementId or relations.from/to.
12. Each proposal in your response (each newElement, each updatedElement, each relation) is judged independently — one weak or wrong proposal does NOT cause your other, unrelated proposals in the same response to be discarded. So do not leave out a genuinely grounded proposal just because you are unsure about a different one in the same turn.
13. Every update also needs impliedElementKind (see its schema description) — your best guess at this content's OWN element kind, independent of whether it turns out to really be the same element as targetElementId. This is not a hedge against rule 9 — keep proposing updates when you believe it's genuinely the same element; this field just makes sure the right kind is available if an independent check disagrees.
14. You will be shown "Currently unresolved" points from earlier turns (if any). If the current turn's content is about the SAME open question as one of them, set that unresolvedCandidate's existingUnresolvedId to its exact id (never a guessed or paraphrased id) — this updates it in place. If it's a genuinely new open question, use "none". Do not re-propose an unresolved point that is unrelated to the current turn just because it exists.

Return ONLY the structured JSON matching the given schema.`;

function buildPreviousProposalText(feedback: PreviousProposalFeedback | undefined): string {
  if (!feedback) return "(none — this is the first turn of the session)";
  const rejected = feedback.rejectedRefs.length
    ? `REJECTED last turn — NOT in the graph, do not reference: ${feedback.rejectedRefs.join(", ")}`
    : "(nothing rejected last turn)";
  const uncertain = feedback.uncertainRefs.length
    ? `accepted but flagged uncertain: ${feedback.uncertainRefs.join(", ")}`
    : "";
  const reasons = feedback.reasons.length ? `reasons: ${feedback.reasons.join(" | ")}` : "";
  return [rejected, uncertain, reasons].filter(Boolean).join("\n");
}

function buildUserPrompt(input: InterpreterInput): string {
  const turnsText = input.recentTurns.map((t) => `turn ${t.turn}: "${t.text}"`).join("\n");
  const summary: ContextGraphSummary = input.activeContext;
  const elementsText = summary.elements.length
    ? summary.elements.map((e) => `- id=${e.id} kind=${e.kind} active=${e.active} status=${e.status} confidence=${e.confidence} description="${e.description}"`).join("\n")
    : "(none yet)";
  const relationsText = summary.openRelations.length
    ? summary.openRelations.map((r) => `- id=${r.id} type=${r.type} from=${r.from} to=${r.to} status=${r.status}`).join("\n")
    : "(none yet)";
  const unresolvedText = summary.unresolved.length
    ? summary.unresolved.map((u) => `- id=${u.id} relatesTo=[${u.relatesTo.join(", ")}] reason="${u.reason}" latestGrounding(turn ${u.latestGroundingTurn})="${u.latestGroundingText}"`).join("\n")
    : "(none yet)";

  return `mode: ${input.mode}

Recent turns (a small window, not the full conversation):
${turnsText}

Current active context graph elements:
${elementsText}

Current open relations:
${relationsText}

Currently unresolved (open questions from earlier turns — see rule 14):
${unresolvedText}

Previous turn's proposal outcome (for your awareness only — see rule 11):
${buildPreviousProposalText(input.previousProposal)}

Analyze the MOST RECENT turn in light of the context above and this small window. Propose only what is actually grounded in the text.`;
}

type RawOutput = {
  newElements: Array<{ localRef: string; kind: string; description: string; groundingQuote: string; groundingTurn: number; confidence: number }>;
  updatedElements: Array<{ targetElementId: string; kind: string; identityRelation: string; impliedElementKind: string; note: string; groundingQuote: string; groundingTurn: number; confidence: number }>;
  relations: Array<{ type: string; from: string; to: string; groundingQuote: string; groundingTurn: number; confidence: number }>;
  unresolvedCandidates: Array<{ existingUnresolvedId: string; relatesTo: string[]; reason: string; groundingQuote: string; groundingTurn: number; uncertainty: number; potentialInformationGain: string }>;
  confidence: number;
  uncertaintyNotes: string[];
};

const ELEMENT_KINDS = new Set(["situation", "direction", "constraint", "response"]);
const UPDATE_KINDS = new Set(["reinforce", "specify", "revise", "conflict", "deprioritize", "resolve"]);
const RELATION_TYPES = new Set(["limits", "supports", "conflictsWith", "respondsTo", "clarifies", "revises", "relatesTo"]);
const INFO_GAIN = new Set(["low", "medium", "high"]);
const IDENTITY_RELATIONS = new Set(["continuation", "clarification", "revision", "uncertainSameElement"]);

/** Minimal structural shape check — NOT a semantic truth check (that's
 *  the Validator's job downstream, and even the Validator only does
 *  structural checks — see validator.ts's own documented limits). */
function isValidRawOutput(x: unknown): x is RawOutput {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (!Array.isArray(o.newElements) || !Array.isArray(o.updatedElements) || !Array.isArray(o.relations) || !Array.isArray(o.unresolvedCandidates)) return false;
  if (typeof o.confidence !== "number" || !Array.isArray(o.uncertaintyNotes)) return false;
  for (const el of o.newElements as any[]) {
    if (typeof el.localRef !== "string" || !ELEMENT_KINDS.has(el.kind) || typeof el.description !== "string" || typeof el.groundingQuote !== "string" || typeof el.groundingTurn !== "number" || typeof el.confidence !== "number") return false;
  }
  for (const u of o.updatedElements as any[]) {
    if (typeof u.targetElementId !== "string" || !UPDATE_KINDS.has(u.kind) || !IDENTITY_RELATIONS.has(u.identityRelation) || !ELEMENT_KINDS.has(u.impliedElementKind) || typeof u.note !== "string" || typeof u.groundingQuote !== "string" || typeof u.groundingTurn !== "number" || typeof u.confidence !== "number") return false;
  }
  for (const r of o.relations as any[]) {
    if (!RELATION_TYPES.has(r.type) || typeof r.from !== "string" || typeof r.to !== "string" || typeof r.groundingQuote !== "string" || typeof r.groundingTurn !== "number" || typeof r.confidence !== "number") return false;
  }
  for (const u of o.unresolvedCandidates as any[]) {
    if (typeof u.existingUnresolvedId !== "string" || !Array.isArray(u.relatesTo) || typeof u.reason !== "string" || typeof u.groundingQuote !== "string" || typeof u.groundingTurn !== "number" || typeof u.uncertainty !== "number" || !INFO_GAIN.has(u.potentialInformationGain)) return false;
  }
  return true;
}

function emptyOutput(note: string): InterpreterOutput {
  return { newElements: [], updatedElements: [], relations: [], unresolvedCandidates: [], confidence: 0, uncertaintyNotes: [note] };
}

/**
 * `currentTurn` is used only as a fallback for the (no longer
 * expected) case where the model omits groundingTurn entirely — since
 * the schema now marks it required, this is defensive only. The real
 * fix (Sprint12-E Gate report section R) is that the model's own
 * groundingTurn is trusted directly instead of assuming every
 * proposal is grounded in the latest turn — a proposal legitimately
 * grounded in an earlier turn (e.g. an update citing what was said
 * two turns ago) must be tagged with THAT turn, or V1 grounding
 * validation rejects it as untraceable.
 *
 * localRef namespacing (Sprint12-E Gate report section R, found
 * empirically): evaluationHarness.ts's mergeInterpreterOutput()
 * persists `localRef` AS THE PERMANENT graph element id (a Sprint12-D
 * design choice — see that file's own comment). The model was told
 * localRef is "a short fresh handle", which it reasonably read as
 * scoped to one response the way a real id-less draft would be — so
 * it reused generic values like "new-1" on unrelated turns, which
 * would silently collide once persisted verbatim. The adapter is
 * responsible for the uniqueness guarantee (this was already stated
 * in evaluationHarness.ts's own doc comment when the id-persistence
 * design was introduced) — every new element's localRef is namespaced
 * by turn here, and any relation.from/to that matches one of THIS
 * batch's raw (pre-namespace) localRefs is remapped to match.
 */
function toInterpreterOutput(raw: RawOutput, currentTurn: number): InterpreterOutput {
  const namespace = (ref: string) => `t${currentTurn}-${ref}`;
  const rawLocalRefs = new Set(raw.newElements.map((e) => e.localRef));

  const newElements: ProposedElement[] = raw.newElements.map((e) => ({
    localRef: namespace(e.localRef),
    kind: e.kind as ProposedElement["kind"],
    description: e.description,
    groundingTurn: e.groundingTurn ?? currentTurn,
    groundingText: e.groundingQuote,
    confidence: e.confidence,
  }));
  const updatedElements: ProposedUpdate[] = raw.updatedElements.map((u) => ({
    targetElementId: u.targetElementId,
    kind: u.kind as ProposedUpdate["kind"],
    identityRelation: u.identityRelation as IdentityRelation,
    impliedElementKind: u.impliedElementKind as ProposedUpdate["impliedElementKind"],
    note: u.note,
    groundingTurn: u.groundingTurn ?? currentTurn,
    groundingText: u.groundingQuote,
    confidence: u.confidence,
  }));
  const remapRef = (ref: string) => (rawLocalRefs.has(ref) ? namespace(ref) : ref);
  const relations: ProposedRelation[] = raw.relations.map((r) => ({
    type: r.type as ProposedRelation["type"],
    from: remapRef(r.from),
    to: remapRef(r.to),
    groundingTurn: r.groundingTurn ?? currentTurn,
    groundingText: r.groundingQuote,
    confidence: r.confidence,
  }));
  const unresolvedCandidates: ProposedUnresolved[] = raw.unresolvedCandidates.map((u) => ({
    // "none" sentinel (strict JSON schema has no true optional fields —
    // same pattern as suggestedRelationType in the identity reviewer
    // adapter) maps to undefined, meaning "genuinely new" downstream.
    // Never passed through remapRef: existingUnresolvedId references an
    // already-PERSISTED graph id, not a same-batch newElement localRef.
    existingUnresolvedId: u.existingUnresolvedId === "none" ? undefined : u.existingUnresolvedId,
    relatesTo: u.relatesTo.map(remapRef),
    reason: u.reason,
    groundingTurn: u.groundingTurn ?? currentTurn,
    groundingText: u.groundingQuote,
    uncertainty: u.uncertainty,
    potentialInformationGain: u.potentialInformationGain as ProposedUnresolved["potentialInformationGain"],
  }));
  return { newElements, updatedElements, relations, unresolvedCandidates, confidence: raw.confidence, uncertaintyNotes: raw.uncertaintyNotes };
}

/**
 * `externalStats`, when provided, is pushed into directly instead of a
 * fresh local array — lets a caller (e.g. an evaluation driver using
 * runEvaluation's `interpreterFactory: () => SemanticContextInterpreter`
 * signature, which has no room to return stats per instance) collect
 * every call's stats into one shared array across a whole run without
 * modifying evaluationHarness.ts itself.
 */
export function createSemanticProviderAdapter(externalStats?: ProviderCallStat[]): { interpreter: SemanticContextInterpreter; stats: ProviderCallStat[] } {
  const stats: ProviderCallStat[] = externalStats ?? [];
  const apiKey = process.env.OPENAI_API_KEY;

  const interpreter: SemanticContextInterpreter = {
    async interpret(input: InterpreterInput): Promise<InterpreterOutput> {
      const currentTurn = input.recentTurns[input.recentTurns.length - 1]?.turn ?? 0;
      if (!apiKey) {
        stats.push({ turn: currentTurn, outcome: "HTTP_ERROR", latencyMs: 0, errorMessage: "OPENAI_API_KEY not set" });
        return emptyOutput("OPENAI_API_KEY not set");
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
            response_format: { type: "json_schema", json_schema: { name: "context_interpretation", strict: true, schema: RAW_OUTPUT_SCHEMA } },
            temperature: 0,
          }),
        });
      } catch (err) {
        stats.push({ turn: currentTurn, outcome: "HTTP_ERROR", latencyMs: Date.now() - start, errorMessage: String(err) });
        return emptyOutput("HTTP request failed");
      }
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        stats.push({ turn: currentTurn, outcome: "HTTP_ERROR", latencyMs, errorMessage: `HTTP ${res.status}: ${bodyText.slice(0, 300)}` });
        return emptyOutput(`HTTP ${res.status}`);
      }

      const body = await res.json().catch(() => undefined);
      const usage = body?.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
      const content: string | undefined = body?.choices?.[0]?.message?.content;

      if (!content) {
        stats.push({ turn: currentTurn, outcome: "PARSE_ERROR", latencyMs, errorMessage: "no content in response", inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens });
        return emptyOutput("no content in provider response");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        stats.push({ turn: currentTurn, outcome: "PARSE_ERROR", latencyMs, errorMessage: String(err), inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens });
        return emptyOutput("JSON.parse failed on provider content");
      }

      if (!isValidRawOutput(parsed)) {
        stats.push({ turn: currentTurn, outcome: "SCHEMA_ERROR", latencyMs, errorMessage: "shape check failed", inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens });
        return emptyOutput("provider output failed shape validation");
      }

      stats.push({ turn: currentTurn, outcome: "SUCCESS", latencyMs, inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens });
      return toInterpreterOutput(parsed, currentTurn);
    },
  };

  return { interpreter, stats };
}
