/**
 * Context-First Semantic Shadow Core — Option B Phase 1.
 *
 * Provider-specific code, isolated in this directory only, same rule as
 * the legacy adapters: nothing outside providers/ imports the OpenAI
 * API, and this file is never imported by controller.ts /
 * questionPlanner.ts / decisionGate.ts / reflectionComposer.ts /
 * understandingEngine.ts / observationPlanner.ts.
 *
 * This is NOT a modification of semanticProviderAdapter.ts /
 * identityReview.ts / semanticIdentityReviewerAdapter.ts (the "Legacy
 * Experimental Core") — those files are untouched, kept side-by-side
 * for comparison and rollback (§4/§28). This file replaces their
 * COMBINED job with a single `SemanticContextInterpreter` that never
 * commits to `targetElementId` before an explicit epistemic step.
 *
 * Final Architecture Gate finding (this session, prior report): three
 * consecutive sprints (E4, E5, E6) each fixed one identity-classification
 * bias and reliably reintroduced another, all within a structure where
 * the Interpreter picks `targetElementId` unilaterally and an
 * independent Reviewer is shown only that ONE pre-committed target with
 * no ability to say "wrong target" or "ambiguous among targets" — a
 * confirmed structural defect (Target Anchoring), not a prompt-wording
 * problem. This adapter's ONLY architectural change from Legacy is
 * ordering: DECIDABILITY is assessed against the FULL active context
 * before any specific existing element is nominated, in a single LLM
 * call (Option A per Final Architecture Gate §11 — see that report for
 * why not a second call).
 *
 * Contract reuse (§7): NO new exported types. `newElements`,
 * `updatedElements`, `relations`, `unresolvedCandidates` are the exact
 * same `ProposedElement` / `ProposedUpdate` / `ProposedRelation` /
 * `ProposedUnresolved` shapes types.ts has carried since Sprint12-D/E2 —
 * only WHEN and HOW this adapter populates them changes, not their
 * shape. `identityRelation` and `impliedElementKind` remain required
 * fields on `ProposedUpdate` (Legacy Contract, unchanged) even though
 * their original purpose (feeding an independent Reviewer that might
 * disagree and promote) doesn't apply here — see toProposedUpdate()
 * below for the honest values used instead of inventing new meaning.
 */
import type {
  ContextGraphSummary,
  ElementKind,
  IdentityRelation,
  InterpreterInput,
  InterpreterOutput,
  PreviousProposalFeedback,
  ProposedElement,
  ProposedRelation,
  ProposedUnresolved,
  ProposedUpdate,
  RelationType,
  SemanticContextInterpreter,
} from "../types";

const MODEL = "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Sprint "Option B Phase 1" §9/§19: TECHNICAL_FAILURE is a call-level
 * outcome, structurally separate from any per-item epistemic
 * NOT_DECIDABLE. A technical failure always returns an EMPTY
 * InterpreterOutput (see emptyOutput below) — zero newElements, zero
 * updatedElements, zero unresolvedCandidates — so it can NEVER be
 * merged into the graph as if it were a legitimate "the evidence
 * didn't settle this" epistemic state. This is enforced structurally,
 * not just by convention: there is no code path from a fetch/parse/
 * schema failure into anything that looks like a NOT_DECIDABLE
 * placement.
 */
/**
 * Sprint "Option B Phase 1.5" §3/§10: CONTRACT_FAILURE is a THIRD,
 * distinct outcome — not a technical/network failure (the call
 * succeeded, the payload parsed, the shape was valid) and not a
 * legitimate epistemic state (the model's own `coverageDisposition`
 * claim isn't backed by a matching placement — see
 * hasCoverageIntegrity below). Root cause this Sprint fixes: Phase 1's
 * `isValidRawOutput` only checked SHAPE (are the types right?), never
 * checked COVERAGE (did the model actually say anything about the
 * current turn?) — an empty `placements` array was shape-valid, so it
 * silently became a "successful" call with zero trace of the user's
 * evidence anywhere (found in WEB CASE B turn 2, Phase 1 report §W).
 * Like TECHNICAL_FAILURE, CONTRACT_FAILURE always returns an empty
 * InterpreterOutput (zero graph mutation, zero unresolved) — a broken
 * promise about the current turn must never be smuggled into the graph
 * as if it were a legitimate NOT_DECIDABLE assertion.
 */
export type ContextFirstCallOutcome = "SUCCESS" | "TECHNICAL_FAILURE" | "CONTRACT_FAILURE";

export type ContextFirstCallStat = {
  turn: number;
  outcome: ContextFirstCallOutcome;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  errorMessage?: string;
};

const ELEMENT_KINDS = ["situation", "direction", "constraint", "response"] as const;
const UPDATE_KINDS = ["reinforce", "specify", "revise", "conflict", "deprioritize", "resolve"] as const;
const RELATION_TYPES = ["limits", "supports", "conflictsWith", "respondsTo", "clarifies", "revises", "relatesTo"] as const;
/** Only 3 values offered here (not the Legacy 4th, "uncertainSameElement")
 *  — by construction, an EXISTING_ELEMENT_UPDATE placement only exists
 *  because decidability was already DECIDABLE; asking for identity
 *  uncertainty again on the same field would re-introduce the exact
 *  ambiguity this adapter's ordering is designed to resolve upstream. */
const IDENTITY_SUBKINDS = ["continuation", "clarification", "revision"] as const;

const SYSTEM_PROMPT = `You are a Context-First Semantic Interpreter for a human reflection tool (HRI). You are NOT a conversational assistant, and you never generate a question, advice, reflection, or any text meant for the user to read.

Your job is to read the user's recent turns and the FULL current context graph. Work through these PHASES in order — a later phase never revises a decision an earlier phase already made:

PHASE 1 — PLACEMENT. For each distinct, groundable piece of content in the MOST RECENT turn, work through exactly this order — never the reverse:

STEP 1 — DECIDABILITY. Before deciding WHAT this content is, decide whether that can be decided at all, looking at the ENTIRE active context (all existing elements, not any one of them singled out) plus this content's own wording. Ask:
- Could you justify ONE specific placement (the same as one specific existing element, vs. a new independent element) without guessing something the user never said?
- Are there multiple existing elements this could plausibly be the same as, with nothing in the text favoring one over the others?
- Is the content itself (its own wording, independent of anything already in the graph) too vague or under-specified (a bare pronoun, "that", "it", a filler phrase) to support a confident placement?
If any of these apply, decidability is NOT_DECIDABLE. This is not a measure of how hard the question feels — it is a measure of whether the evidence itself settles it. Do not let the mere existence of similar-looking existing elements manufacture a placement the text doesn't actually support. NOT_DECIDABLE is a normal, honest, frequent answer, not a failure — never avoid it just to look more capable.

STEP 2 — PLACEMENT (only meaningful if DECIDABLE; if NOT_DECIDABLE, still fill in your best lean, but it will be discarded):
(a) EXISTING_ELEMENT_UPDATE — this content is the SAME underlying referent as ONE SPECIFIC existing element already in the graph: a continuation, clarification, correction, or revision of it over time (a revision changes the STATE/priority/direction of the same real-world matter — e.g. "I should go soon" -> "actually it can wait" is still the same trip, not a new one). Choosing this means completing THREE commitments together, not just one: its real existing id exactly as shown to you; a real updateKind (reinforce/specify/revise/conflict/deprioritize/resolve) — never left vague; and a real identitySubkind (continuation/clarification/revision). Do not choose EXISTING_ELEMENT_UPDATE unless you can commit to a specific, defensible answer for all three — if you cannot, it is NEW_ELEMENT instead.
(b) NEW_ELEMENT — this is genuinely independent content: either because it plays a different role within the same broader episode as something existing (e.g. a Constraint on an existing Direction), or because it has no real connection to anything existing at all. Either way it is its own new element, never forced into an existing one's description.
Prefer (a) only when it genuinely fits — do not force a match just because SOME existing element is topically nearby.
Decide each placement on ITS OWN merits — never choose NEW_ELEMENT in order to have "something to relate" later. Relation is decided in a later, separate phase and must never influence this one.

PHASE 2 — COVERAGE (mandatory, no exceptions; you fill this AFTER every placement above — it is the coverageDisposition field, positioned after placements in the JSON). The user said something in the most recent turn. You must account for it: either place at least one piece of it (coverageDisposition=REPRESENTED, backed by at least one DECIDABLE placement above with placementKind!=none), or explicitly preserve it as unresolved (coverageDisposition=UNRESOLVED, backed by at least one NOT_DECIDABLE placement above). An empty placements array is NEVER a valid response — that would mean the user's words left no trace anywhere, which is not allowed. If the turn's content is too vague to place, that is exactly what NOT_DECIDABLE + an unresolvedCandidate is for — use it, do not simply omit the turn. Before writing this field, re-read the placements you already wrote above and choose the value that HONESTLY matches them: never REPRESENTED if none of your placements above are DECIDABLE with placementKind!=none; never UNRESOLVED if none of your placements above are NOT_DECIDABLE.

PHASE 3 — RELATION (the relations array, positioned LAST in the JSON, after placements and coverageDisposition are both already final). The placements above are DONE — do not alter, reconsider, or reinterpret them here, and never invent a placement in order to create a relation. Now, looking ONLY at what already exists — the placements you just wrote above, plus any pre-existing graph elements — ask: does the CURRENT turn's evidence explicitly support a connection between two DIFFERENT already-represented things (an existing element, or a new element you proposed above; for an EXISTING_ELEMENT_UPDATE placement, its real targetElementId counts as "already represented")? For each connection you can genuinely defend with real textual grounds, add one entry: which two things (never the same one twice), a specific type (limits/supports/conflictsWith/respondsTo/clarifies/revises) with real textual grounds, or relatesTo if no more specific type fits. If nothing is genuinely supported, leave the relations array empty — this is a normal, common, honest outcome, not a failure, and never a reason to go back and change a placement.

Rules:
0. Write every description/note/reason/quote in the SAME language as the source turns — never translate.
1. Every placement needs a groundingQuote — a literal substring actually present in the turns you were given. Never invent facts not in the text.
2. When referencing an EXISTING element or an existing unresolved point, you MUST use its real id exactly as shown to you. Never guess or paraphrase an id.
3. Preserve negation exactly as stated.
4. You will be shown "Currently unresolved" points from earlier turns. If this content is about the SAME open question as one of them, reference its exact id so it updates in place instead of duplicating. Otherwise say "none".
5. If you are given "Previous turn's proposal outcome" with a REJECTED list, those ids do NOT exist in the graph — never reference them.
6. confidence must reflect genuine uncertainty, not always near 1.0.
7. Do not apply fixed keyword/domain categories to decide role or relation (e.g. do not treat "work" vs "friend" as an automatic separate-topic rule, and do not treat sentence length or a pronoun by itself as automatically meaning NOT_DECIDABLE) — judge meaning, case by case.

Return ONLY the structured JSON matching the given schema, filling fields in the order given: all of placements first (decidability before placement, for each), then coverageDisposition, then relations last.`;

const RAW_SCHEMA = {
  type: "object",
  properties: {
    placements: {
      type: "array",
      description: "One entry per distinct, groundable piece of content in the MOST RECENT turn worth tracking. Not every word needs an entry.",
      items: {
        type: "object",
        properties: {
          groundingQuote: { type: "string", description: "A literal substring of the MOST RECENT turn's text." },
          decidability: { type: "string", enum: ["DECIDABLE", "NOT_DECIDABLE"] },
          decidabilityReason: { type: "string", description: "One short sentence, from the evidence itself." },
          placementKind: { type: "string", enum: ["EXISTING_ELEMENT_UPDATE", "NEW_ELEMENT", "none"], description: "Only meaningful when decidability is DECIDABLE; use 'none' otherwise." },

          targetElementId: { type: "string", description: "Real existing element id from the context shown to you, only when placementKind is EXISTING_ELEMENT_UPDATE. Otherwise 'none'." },
          updateKind: { type: "string", enum: [...UPDATE_KINDS], description: "REQUIRED in every placement (the output format allows no omitted fields) — but only BINDING when placementKind is EXISTING_ELEMENT_UPDATE, where it MUST be a real, specific, defensible choice, never a placeholder: what kind of change is this to the existing element? When placementKind is NOT EXISTING_ELEMENT_UPDATE, this value is never read by the system — write 'reinforce' as an inert filler." },
          identitySubkind: { type: "string", enum: [...IDENTITY_SUBKINDS], description: "REQUIRED in every placement, same reason as updateKind — but only BINDING when placementKind is EXISTING_ELEMENT_UPDATE, where it MUST be a real, specific choice (continuation / clarification / revision), never a placeholder. Ignored otherwise — write 'continuation' as an inert filler." },
          updateNote: { type: "string", description: "Only when placementKind is EXISTING_ELEMENT_UPDATE." },

          localRef: { type: "string", description: "A short fresh handle for this NEW element (e.g. 'new-1'), only when placementKind is NEW_ELEMENT. Otherwise 'none'." },
          newElementKind: { type: "string", enum: [...ELEMENT_KINDS, "none"], description: "Only when placementKind is NEW_ELEMENT." },

          existingUnresolvedId: { type: "string", description: "Only when decidability is NOT_DECIDABLE: the exact id of a matching 'Currently unresolved' point shown to you, or 'none' if this is a new open question." },
          unresolvedReason: { type: "string", description: "Only when decidability is NOT_DECIDABLE: a descriptive sentence, never a question." },
          unresolvedRelatesTo: { type: "array", items: { type: "string" }, description: "Existing element ids this open question relates to, if any. Empty array if none." },
          uncertainty: { type: "number", description: "0 to 1. Only meaningful when decidability is NOT_DECIDABLE." },
          potentialInformationGain: { type: "string", enum: ["low", "medium", "high"] },

          confidence: { type: "number", description: "0 to 1. Genuine uncertainty, not always high." },
        },
        required: [
          "groundingQuote", "decidability", "decidabilityReason", "placementKind",
          "targetElementId", "updateKind", "identitySubkind", "updateNote",
          "localRef", "newElementKind",
          "existingUnresolvedId", "unresolvedReason", "unresolvedRelatesTo", "uncertainty", "potentialInformationGain",
          "confidence",
        ],
        additionalProperties: false,
      },
    },
    coverageDisposition: {
      type: "string",
      enum: ["REPRESENTED", "UNRESOLVED"],
      description: "Declare this AFTER every placement above is already written: for the MOST RECENT turn's content overall, is at least one piece of it clear enough to place (REPRESENTED — requires at least one DECIDABLE placement above with placementKind!=none), or should it be preserved as an open question instead (UNRESOLVED — requires at least one NOT_DECIDABLE placement above)? Every normal turn gets one of these two — there is no third option for 'nothing to say'. Even a vague or filler turn is UNRESOLVED, not silence. This must accurately summarize the placements you already wrote above, not a separate, independent guess.",
    },
    relations: {
      type: "array",
      description: "Declare this LAST, after placements and coverageDisposition above are both final. One entry per grounded connection between two DIFFERENT already-represented things (see PHASE 3 in the instructions). Do NOT use this to re-decide or re-express any placement above — it only records connections BETWEEN what already exists. An empty array is a normal, common, honest result when nothing above is genuinely connected to anything else — never force an entry to avoid an empty array.",
      items: {
        type: "object",
        properties: {
          fromRef: { type: "string", description: "One side of the connection: a real existing element id shown to you, or the localRef of a NEW_ELEMENT placement you proposed above. For an EXISTING_ELEMENT_UPDATE placement, its real targetElementId may be used here." },
          toRef: { type: "string", description: "The OTHER side of the connection, same rules as fromRef. Must be genuinely different from fromRef — a relation is never to itself." },
          relationType: { type: "string", enum: [...RELATION_TYPES], description: "A specific type (limits/supports/conflictsWith/respondsTo/clarifies/revises) with real textual grounds, or relatesTo if no more specific type fits." },
          groundingQuote: { type: "string", description: "A literal substring of the MOST RECENT turn's text supporting this specific connection." },
          confidence: { type: "number", description: "0 to 1. Genuine uncertainty, not always high." },
        },
        required: ["fromRef", "toRef", "relationType", "groundingQuote", "confidence"],
        additionalProperties: false,
      },
    },
    confidence: { type: "number" },
    uncertaintyNotes: { type: "array", items: { type: "string" } },
  },
  required: ["placements", "coverageDisposition", "relations", "confidence", "uncertaintyNotes"],
  additionalProperties: false,
} as const;

function buildPreviousProposalText(feedback: PreviousProposalFeedback | undefined): string {
  if (!feedback) return "(none — this is the first turn of the session)";
  const rejected = feedback.rejectedRefs.length ? `REJECTED last turn — NOT in the graph, do not reference: ${feedback.rejectedRefs.join(", ")}` : "(nothing rejected last turn)";
  const uncertain = feedback.uncertainRefs.length ? `accepted but flagged uncertain: ${feedback.uncertainRefs.join(", ")}` : "";
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

Full active context graph elements (consider ALL of these when assessing decidability — do not evaluate against just one):
${elementsText}

Current open relations:
${relationsText}

Currently unresolved (open questions from earlier turns — see rule 4):
${unresolvedText}

Previous turn's proposal outcome (for your awareness only — see rule 5):
${buildPreviousProposalText(input.previousProposal)}

For each distinct piece of content in the MOST RECENT turn, work through PHASE 1 (STEP 1 decidability, then STEP 2 placement). Only once every placement is final, do PHASE 2 (coverage). Only once that is also final, do PHASE 3 (relation).`;
}

type RawPlacement = {
  groundingQuote: string;
  decidability: string;
  decidabilityReason: string;
  placementKind: string;
  targetElementId: string;
  updateKind: string;
  identitySubkind: string;
  updateNote: string;
  localRef: string;
  newElementKind: string;
  existingUnresolvedId: string;
  unresolvedReason: string;
  unresolvedRelatesTo: string[];
  uncertainty: number;
  potentialInformationGain: string;
  confidence: number;
};
/** Sprint "Option B Phase 2.8": relation is now a top-level array,
 *  decided in a separate phase AFTER placements/coverage are final —
 *  see §B/§C of that Sprint's report for why (relation fields living
 *  inside RawPlacement let relation-consideration bleed into placement
 *  decisions in the same generative object). */
type RawRelation = {
  fromRef: string;
  toRef: string;
  relationType: string;
  groundingQuote: string;
  confidence: number;
};
type RawOutput = { coverageDisposition: string; placements: RawPlacement[]; relations: RawRelation[]; confidence: number; uncertaintyNotes: string[] };

const ELEMENT_KIND_SET = new Set<string>(ELEMENT_KINDS);
const UPDATE_KIND_SET = new Set<string>(UPDATE_KINDS);
const RELATION_TYPE_SET = new Set<string>(RELATION_TYPES);
const IDENTITY_SUBKIND_SET = new Set<string>(IDENTITY_SUBKINDS);
const INFO_GAIN_SET = new Set(["low", "medium", "high"]);
const DECIDABILITY_SET = new Set(["DECIDABLE", "NOT_DECIDABLE"]);
const PLACEMENT_KIND_SET = new Set(["EXISTING_ELEMENT_UPDATE", "NEW_ELEMENT", "none"]);
const COVERAGE_DISPOSITION_SET = new Set(["REPRESENTED", "UNRESOLVED"]);

/**
 * Minimal structural shape check — NOT a semantic truth check (that's
 * the Validator's job downstream, reused unchanged — see §25).
 *
 * Sprint "Option B Phase 2.6" §4: `activeElementIds` closes a latent
 * gap alongside the updateKind/identitySubkind enum fix below — a
 * EXISTING_ELEMENT_UPDATE placement whose targetElementId is not
 * actually one of the ids shown to the model this turn used to pass
 * this shape check (targetElementId only had to be *a* string) and
 * would then silently no-op at merge time (evaluationHarness.ts's
 * mergeInterpreterOutput: `if (idx === -1) continue`) — a broken
 * promise reaching the graph as if nothing was wrong, same failure
 * shape CONTRACT_FAILURE exists to catch, just one layer lower. Now
 * caught here as TECHNICAL_FAILURE instead, never silently dropped.
 */
function isValidRawOutput(x: unknown, activeElementIds: Set<string>): x is RawOutput {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (!COVERAGE_DISPOSITION_SET.has(o.coverageDisposition as string)) return false;
  if (!Array.isArray(o.placements) || typeof o.confidence !== "number" || !Array.isArray(o.uncertaintyNotes)) return false;
  if (!Array.isArray(o.relations)) return false;
  for (const p of o.placements as any[]) {
    if (typeof p.groundingQuote !== "string") return false;
    if (!DECIDABILITY_SET.has(p.decidability)) return false;
    if (typeof p.decidabilityReason !== "string") return false;
    if (!PLACEMENT_KIND_SET.has(p.placementKind)) return false;
    if (typeof p.targetElementId !== "string" || typeof p.updateKind !== "string" || typeof p.identitySubkind !== "string" || typeof p.updateNote !== "string") return false;
    if (typeof p.localRef !== "string" || typeof p.newElementKind !== "string") return false;
    if (typeof p.existingUnresolvedId !== "string" || typeof p.unresolvedReason !== "string" || !Array.isArray(p.unresolvedRelatesTo)) return false;
    if (typeof p.uncertainty !== "number" || !INFO_GAIN_SET.has(p.potentialInformationGain)) return false;
    if (typeof p.confidence !== "number") return false;
    if (p.placementKind === "EXISTING_ELEMENT_UPDATE" && (!UPDATE_KIND_SET.has(p.updateKind) || !IDENTITY_SUBKIND_SET.has(p.identitySubkind))) return false;
    if (p.placementKind === "EXISTING_ELEMENT_UPDATE" && !activeElementIds.has(p.targetElementId)) return false;
    if (p.placementKind === "NEW_ELEMENT" && !ELEMENT_KIND_SET.has(p.newElementKind)) return false;
  }
  for (const r of o.relations as any[]) {
    if (typeof r.fromRef !== "string" || typeof r.toRef !== "string") return false;
    if (typeof r.groundingQuote !== "string" || typeof r.confidence !== "number") return false;
    if (!RELATION_TYPE_SET.has(r.relationType)) return false;
  }
  return true;
}

/**
 * Sprint "Option B Phase 1.5" §8/§9: the coverage cross-invariant.
 * Deliberately does NOT parse `decidabilityReason`/`unresolvedReason`/
 * any free text (§13) — only typed `coverageDisposition`,
 * `decidability`, and `placementKind` are consulted. This is the
 * boundary that turns a merely shape-valid-but-empty response into a
 * detected CONTRACT_FAILURE instead of a silently-accepted SUCCESS.
 */
function hasCoverageIntegrity(raw: RawOutput): boolean {
  if (raw.coverageDisposition === "REPRESENTED") {
    return raw.placements.some((p) => p.decidability === "DECIDABLE" && p.placementKind !== "none");
  }
  if (raw.coverageDisposition === "UNRESOLVED") {
    return raw.placements.some((p) => p.decidability === "NOT_DECIDABLE");
  }
  return false;
}

function emptyOutput(note: string): InterpreterOutput {
  return { newElements: [], updatedElements: [], relations: [], unresolvedCandidates: [], confidence: 0, uncertaintyNotes: [note] };
}

/**
 * Sprint "Option B Phase 1" §8: the crucial ordering guarantee lives
 * HERE — this function only ever constructs a ProposedUpdate (which
 * commits to targetElementId) for placements the MODEL ITSELF already
 * marked decidability=DECIDABLE. A NOT_DECIDABLE placement, regardless
 * of what targetElementId/placementKind fields it happens to carry
 * (the model is told these will be discarded), is routed to
 * unresolvedCandidates only — never to updatedElements/newElements.
 * This mirrors identityReview.ts's E6/E8 "strip decision when
 * NOT_DECIDABLE" invariant, but enforced at the point of construction
 * in a single adapter rather than a separate review pass.
 */
function toInterpreterOutput(raw: RawOutput, currentTurn: number): InterpreterOutput {
  const namespace = (ref: string) => `t${currentTurn}-${ref}`;
  const rawLocalRefs = new Set(raw.placements.filter((p) => p.placementKind === "NEW_ELEMENT" && p.localRef !== "none").map((p) => p.localRef));
  const remapRef = (ref: string) => (rawLocalRefs.has(ref) ? namespace(ref) : ref);

  const newElements: ProposedElement[] = [];
  const updatedElements: ProposedUpdate[] = [];
  const relations: ProposedRelation[] = [];
  const unresolvedCandidates: ProposedUnresolved[] = [];

  /**
   * Sprint "Option B Phase 2.8" §C/§F: targetElementId, for every
   * EXISTING_ELEMENT_UPDATE placement this turn, is a legitimate
   * relation endpoint too (PHASE 3's own instructions say so) — a
   * top-level relation naming that id is honestly referencing an
   * "already represented" thing, same as referencing any other
   * pre-existing graph element id. No remap needed for these (they are
   * already real graph ids, unlike a same-turn NEW_ELEMENT localRef).
   */
  for (const p of raw.placements) {
    if (p.decidability === "NOT_DECIDABLE") {
      unresolvedCandidates.push({
        existingUnresolvedId: p.existingUnresolvedId === "none" ? undefined : p.existingUnresolvedId,
        relatesTo: p.unresolvedRelatesTo,
        reason: p.unresolvedReason || p.decidabilityReason,
        groundingTurn: currentTurn,
        groundingText: p.groundingQuote,
        uncertainty: p.uncertainty,
        potentialInformationGain: p.potentialInformationGain as ProposedUnresolved["potentialInformationGain"],
      });
      continue;
    }

    if (p.placementKind === "EXISTING_ELEMENT_UPDATE") {
      updatedElements.push({
        targetElementId: p.targetElementId,
        kind: p.updateKind as ProposedUpdate["kind"],
        identityRelation: p.identitySubkind as IdentityRelation,
        // No downstream Reviewer to promote a disagreement here (§8/§16
        // header comment) — honestly reuses the target's own kind, same
        // "no second opinion available, don't invent one" precedent
        // ruleBasedAdapter.ts already established.
        impliedElementKind: "situation" as ElementKind, // placeholder overwritten below once target kind is known by caller; see interpret()
        note: p.updateNote,
        groundingTurn: currentTurn,
        groundingText: p.groundingQuote,
        confidence: p.confidence,
      });
    } else if (p.placementKind === "NEW_ELEMENT") {
      const localRef = namespace(p.localRef);
      newElements.push({
        localRef,
        kind: p.newElementKind as ElementKind,
        // Uses groundingQuote as the description, not a separately
        // model-generated free-text field — found empirically (this
        // Phase's own smoke test S1): a free-text description has no
        // language-consistency guarantee and the model intermittently
        // writes it in English despite rule 0, which fails V2
        // ("description shares no content with its own grounding
        // text") since V2 only checks newElements, never updates.
        // groundingQuote is Contract-required (rule 1) to be a literal,
        // same-language substring of the turn — same fix already
        // proven in Sprint12-E5 for promoted elements.
        description: p.groundingQuote,
        groundingTurn: currentTurn,
        groundingText: p.groundingQuote,
        confidence: p.confidence,
      });
    }
    // placementKind "none" with decidability DECIDABLE should not occur
    // per schema instructions; if the model produces it anyway, it is
    // silently dropped rather than guessed into a shape — no proposal
    // is safer than a fabricated one.
  }

  /**
   * Sprint "Option B Phase 2.8" §7/§8: relation is now a SEPARATE,
   * top-level pass over `raw.relations` — never inside the placement
   * loop above, so relation-consideration structurally cannot influence
   * (or be influenced by) a placementKind decision; by the time this
   * runs, newElements/updatedElements are already fully decided.
   * fromRef/toRef may each be either a same-turn NEW_ELEMENT localRef
   * (remapped to its namespaced id) or a pre-existing graph element id,
   * including an EXISTING_ELEMENT_UPDATE placement's own targetElementId
   * (already a real graph id, needs no remap). Self-reference (from ===
   * to) is dropped, same invariant Phase 2.7 §7B established.
   */
  for (const r of raw.relations) {
    const from = remapRef(r.fromRef);
    const to = remapRef(r.toRef);
    if (from === to) continue;
    relations.push({
      type: r.relationType as RelationType,
      from,
      to,
      groundingTurn: currentTurn,
      groundingText: r.groundingQuote,
      confidence: r.confidence,
    });
  }

  return { newElements, updatedElements, relations, unresolvedCandidates, confidence: raw.confidence, uncertaintyNotes: raw.uncertaintyNotes };
}

/**
 * `externalStats`, when provided, is pushed into directly — same
 * pattern as the Legacy adapters, for side-by-side comparison (§23).
 */
export function createContextFirstSemanticAdapter(externalStats?: ContextFirstCallStat[]): { interpreter: SemanticContextInterpreter; stats: ContextFirstCallStat[] } {
  const stats: ContextFirstCallStat[] = externalStats ?? [];
  const apiKey = process.env.OPENAI_API_KEY;

  const interpreter: SemanticContextInterpreter = {
    async interpret(input: InterpreterInput): Promise<InterpreterOutput> {
      const currentTurn = input.recentTurns[input.recentTurns.length - 1]?.turn ?? 0;

      if (!apiKey) {
        stats.push({ turn: currentTurn, outcome: "TECHNICAL_FAILURE", latencyMs: 0, errorMessage: "OPENAI_API_KEY not set" });
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
            response_format: { type: "json_schema", json_schema: { name: "context_first_interpretation", strict: true, schema: RAW_SCHEMA } },
            temperature: 0,
          }),
        });
      } catch (err) {
        stats.push({ turn: currentTurn, outcome: "TECHNICAL_FAILURE", latencyMs: Date.now() - start, errorMessage: String(err) });
        return emptyOutput("HTTP request failed");
      }
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        stats.push({ turn: currentTurn, outcome: "TECHNICAL_FAILURE", latencyMs, errorMessage: `HTTP ${res.status}: ${bodyText.slice(0, 300)}` });
        return emptyOutput(`HTTP ${res.status}`);
      }

      const body = await res.json().catch(() => undefined);
      const usage = body?.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
      const content: string | undefined = body?.choices?.[0]?.message?.content;

      if (!content) {
        stats.push({ turn: currentTurn, outcome: "TECHNICAL_FAILURE", latencyMs, errorMessage: "no content in response", inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens });
        return emptyOutput("no content in provider response");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        stats.push({ turn: currentTurn, outcome: "TECHNICAL_FAILURE", latencyMs, errorMessage: String(err), inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens });
        return emptyOutput("JSON.parse failed on provider content");
      }

      const activeElementIds = new Set(input.activeContext.elements.map((e) => e.id));
      if (!isValidRawOutput(parsed, activeElementIds)) {
        stats.push({ turn: currentTurn, outcome: "TECHNICAL_FAILURE", latencyMs, errorMessage: "shape check failed", inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens });
        return emptyOutput("provider output failed shape validation");
      }

      // Sprint "Option B Phase 1.5" §11: shape-valid but coverage-empty
      // (e.g. coverageDisposition=REPRESENTED with zero DECIDABLE
      // placements, or placements=[] entirely) is a CONTRACT_FAILURE —
      // the call succeeded and parsed, but the payload broke its own
      // stated promise about the current turn. Never merged, never
      // treated as NOT_DECIDABLE; no retry is attempted this Phase.
      if (!hasCoverageIntegrity(parsed)) {
        stats.push({ turn: currentTurn, outcome: "CONTRACT_FAILURE", latencyMs, errorMessage: `coverageDisposition=${parsed.coverageDisposition} not backed by a matching placement (placements=${parsed.placements.length})`, inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens });
        return emptyOutput("provider output failed coverage integrity check");
      }

      stats.push({ turn: currentTurn, outcome: "SUCCESS", latencyMs, inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens });

      const output = toInterpreterOutput(parsed, currentTurn);
      // impliedElementKind placeholder (see toInterpreterOutput comment)
      // fixed up here where activeContext is in scope: honestly reuse
      // the actual target element's own kind, when resolvable.
      for (const u of output.updatedElements) {
        const target = input.activeContext.elements.find((e) => e.id === u.targetElementId);
        if (target) (u as ProposedUpdate).impliedElementKind = target.kind;
      }
      return output;
    },
  };

  return { interpreter, stats };
}
