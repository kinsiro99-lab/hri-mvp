/**
 * HRI Intelligence Core — Prototype 1 (Gate 26).
 *
 * Deliberately thin. `Hypothesis` here is NOT a new, competing truth
 * model — it is a projection over `ContextElement`
 * (../context/types.ts), the already-built, already-validated
 * (V1-V10 structural grounding rules, see ../context/validator.ts)
 * Evidence-grounded/non-authoritative/revisable graph model discovered
 * in this Gate's environment audit. Reusing it — rather than inventing
 * a second Hypothesis ontology — is the direct answer to this Gate's
 * "실제 semantic model 경로가 존재하면 그것을 우선 재사용한다" instruction.
 *
 * Nothing in this directory computes meaning itself. Meaning proposals
 * come only from a `SemanticContextInterpreter` (../context/types.ts)
 * — this Gate wires in ../context/providers/contextFirstSemanticAdapter.ts,
 * documented in that file as the most recent, most refined of the
 * three existing provider adapters. If no provider is configured
 * (checked in intelligenceCore.ts), this Core produces zero
 * Hypotheses — it never falls back to a keyword/SEMANTIC_GROUPS
 * classifier to manufacture the appearance of understanding.
 */
import type { ContextElement, ContextGraph, ElementKind, IdentityRelation, RelationType } from "../context/types";

/** Gate 26 §4 asked for active/revised/rejected. ContextElement.status
 *  has five values (active/revised/deprioritized/conflicted/resolved)
 *  — richer than requested, not poorer, so no information is lost by
 *  reusing it directly instead of collapsing to three. `rejected` here
 *  is a display-only merge of deprioritized+conflicted for callers
 *  that only care about the coarse active/revised/rejected distinction
 *  Gate 26 named. */
export type HypothesisStatus = "active" | "revised" | "rejected";

export type Hypothesis = {
  id: string;
  /** = ContextElement.description. HRI's current, provisional reading
   *  — never a User Fact. */
  statement: string;
  /** = ContextElement.evidenceRefs[].sourceText, verbatim. Every
   *  Hypothesis traces back to literal user text by construction — see
   *  ../context/validator.ts's V1 grounding rule, which already rejects
   *  any proposal whose groundingText isn't a real substring of the
   *  turn it cites. */
  evidenceRefs: string[];
  confidence: number;
  status: HypothesisStatus;
  createdAtTurn: number;
};

function toHypothesisStatus(status: ContextElement["status"]): HypothesisStatus {
  if (status === "revised") return "revised";
  if (status === "conflicted" || status === "deprioritized") return "rejected";
  return "active"; // "active" | "resolved" — resolved still displays as the current reading, not discarded
}

/** Pure projection, no interpretation. Called fresh off the current
 *  ContextGraph every turn — there is no separate persisted Hypothesis
 *  list to drift out of sync with the graph that is the actual source
 *  of truth. */
export function hypothesesFromGraph(graph: ContextGraph): Hypothesis[] {
  return graph.elements.map((e) => ({
    id: e.id,
    statement: e.description,
    evidenceRefs: e.evidenceRefs.map((r) => r.sourceText),
    confidence: e.confidence,
    status: toHypothesisStatus(e.status),
    createdAtTurn: e.evidenceRefs[0]?.turn ?? 0,
  }));
}

/**
 * Gate 26 §4 — deliberately does NOT allow a Gap-style free-text field
 * (Gate 22 §11/§12 already ruled that out). What this points AT is
 * always one of: nothing (evidence-anchored fallback), an existing
 * ContextElement (hypothesisRef = its id), an existing UnresolvedPoint
 * (hypothesisRef = its id), or a ContextRelation (relationRef) — never
 * a freshly-invented description of "what's missing".
 *
 * Gate 27 additions (confirm-update, explore-relation) exist because
 * Gate 26's own trace proved the previous five were not enough: CASE X
 * T2 (a genuine update/specify) had nowhere to go but the generic
 * expand-evidence fallback once its target was already "probed" (Gate
 * 26 §O.3), and `graph.relations` — real provider output — was never
 * read by any branch at all (this Gate's investigation §D).
 */
export type QuestionIntent =
  /** Evidence marked uncertain (reused questionCorePrototype.ts marker
   *  check) — no Hypothesis is built from it. */
  | "acknowledge-uncertainty"
  /** Evidence is a correction (reused marker check). */
  | "confirm-change"
  /** This turn's own accepted output updated an EXISTING element
   *  (specify/revise/reinforce/...) — the update itself, not the
   *  element's prior "probed" history, is the question's subject.
   *  Highest-priority Hypothesis-driven branch: a fresh change is
   *  always worth acknowledging before an older, still-open thread. */
  | "confirm-update"
  /** A ContextRelation (limits/supports/conflictsWith/respondsTo/
   *  clarifies/revises/relatesTo) between two elements exists and has
   *  not been asked about yet. */
  | "explore-relation"
  /**
   * Gate 29 — root-cause fix for "Incomplete Sourcing Question"
   * (Gate 29 report §1/§2): CASE A and CASE B were audited turn-by-turn
   * and `graph.relations` was EMPTY on every single turn in both — the
   * provider's own PHASE 3 only proposes a relation when the CURRENT
   * turn's text explicitly, textually supports one (its own system
   * prompt), which short, declarative turns like these rarely do. That
   * makes `explore-relation` above structurally almost-never-reachable
   * in practice, not a bug in this file — see Gate 29 report §5's
   * verdict on the provider.
   *
   * `probe-connection` does NOT wait for the provider to assert a
   * relation. It fires whenever the newest active element has never
   * been asked about IN RELATION TO an older one — and asks, openly,
   * whether/how the two connect. It never asserts a connection exists
   * (epistemicStance is always "open-probe" for this intent, see
   * intelligenceCore.ts) — it only observes, honestly, that two things
   * are now both on the table and haven't been connected yet. This is
   * the direct, evidence-grounded answer to "WHAT IS CONNECTED?" (Gate
   * 29 §3) that does not depend on a rare provider output.
   */
  | "probe-connection"
  /** Targets an existing UnresolvedPoint from the graph. */
  | "explore-unresolved"
  /** Targets an existing active/revised ContextElement with no open
   *  UnresolvedPoint, relation, or unconnected partner yet — a single-
   *  element elaboration. Gate 29 §8: demoted below probe-connection so
   *  it is no longer the dominant "normal progression" branch. */
  | "expand-hypothesis"
  /** No Hypothesis, relation, or UnresolvedPoint available to target —
   *  anchors on raw Evidence only. Taken when the semantic provider is
   *  unavailable, or (rarely) when it produced nothing usable yet. */
  | "expand-evidence";

export type ProviderStatus = "success" | "unavailable" | "error";

/** Gate 27 — only populated for confirm-update: which ElementKind was
 *  updated and how (Sprint12's own IdentityRelation vocabulary,
 *  continuation/clarification/revision), so wording can honestly
 *  distinguish "you added more detail" from "this changed" without
 *  inventing a new taxonomy. */
export type UpdateContext = {
  targetKind: ElementKind;
  updateKind: string; // ContextUpdateKind, minus "create"
  identityRelation: IdentityRelation;
  note: string;
};

/** Gate 27 — only populated for explore-relation. */
export type RelationContext = {
  relationType: RelationType;
  fromKind: ElementKind;
  fromStatement: string;
  toKind: ElementKind;
  toStatement: string;
};

/** Gate 29 — only populated for probe-connection. Deliberately has NO
 *  relationType (unlike RelationContext above) — that would assert a
 *  connection HRI itself hasn't established; this only carries the two
 *  raw statements so the phraser can name both without presuming how
 *  (or whether) they relate. */
export type ConnectionContext = {
  newerKind: ElementKind;
  newerStatement: string;
  olderKind: ElementKind;
  olderStatement: string;
};

/**
 * Gate 28 — the epistemic layer Gate 27's own question critique found
 * missing: Decision correctly chose WHAT to ask about, but nothing
 * told the wording layer HOW CERTAIN that thing was, so the phraser
 * was free to assert a feeling/cause/priority the user never stated
 * ("출장 준비로 인해 어떤 느낌이 드시나요?" — presumes a feeling exists and
 * that it's caused by trip prep; "먼저 처리하고 싶으신가요?" — silently
 * turns the user's own "해야 한다" (must) into "싶다" (want)). Exactly
 * three values, per this Gate's own "복잡한 taxonomy는 만들지 않는다":
 *
 * - "user-stated": the target is (still) verbatim what the user said —
 *   safe to reference directly and confidently.
 * - "hypothesis": the target carries HRI's own inference (a
 *   ContextRelation, always provenance="inferred" by construction; or
 *   a ContextElement whose description has accumulated an update note
 *   beyond its original grounding) — must be phrased as revisable,
 *   never asserted as settled.
 * - "open-probe": no target at all yet, or the target is explicitly
 *   NOT_DECIDABLE (an UnresolvedPoint) / marked uncertain — must not
 *   presume ANY direction, feeling, or cause.
 *
 * Computed deterministically in decideQuestion() from data already on
 * the decision (intent + a verbatim string comparison) — no new LLM
 * classifier, no semantic judgment of the evidence itself.
 */
export type EpistemicStance = "user-stated" | "hypothesis" | "open-probe";

export type QuestionDecision = {
  id: string;
  turn: number;
  intent: QuestionIntent;
  epistemicStance: EpistemicStance;
  /** Verbatim Evidence text(s) this question is grounded in. Always
   *  >= 1 entry. */
  evidenceRefs: string[];
  /** ContextElement.id, UnresolvedPoint.id, or a `rel:` prefixed
   *  synthetic id (see intelligenceCore.ts) this question targets, when
   *  it targets one. */
  hypothesisRef?: string;
  /** The Hypothesis/UnresolvedPoint's own statement, carried through
   *  for audit — never re-derived or paraphrased here. */
  hypothesisStatement?: string;
  /** = the target ContextElement.kind, when this decision targets one
   *  (expand-hypothesis) — drives wording variation by kind
   *  (situation/direction/constraint/response) without inventing new
   *  content; see intelligenceCore.ts's phraseByKind(). */
  elementKind?: ElementKind;
  updateContext?: UpdateContext;
  relationContext?: RelationContext;
  connectionContext?: ConnectionContext;
  /** Human-auditable "why this, not something else" — always names the
   *  actual state fact (uncertain marker / correction marker /
   *  unresolved point id+gain / hypothesis id+confidence / relation
   *  type / provider unavailable), never "the AI decided". */
  reason: string;
  providerStatus: ProviderStatus;
};

/**
 * Grounded Forward Intent Gate 1 — the smallest practical projection of
 * QuestionDecision that separates WHAT is legitimate to explore next
 * from HOW to phrase it (natural-language phrasing is a later,
 * unimplemented layer — see toGroundedForwardIntent's own doc). Not a
 * parallel question engine: every field here is read directly off an
 * already-computed QuestionDecision — decideQuestion() itself keeps
 * deciding WHAT the candidate is; this only re-shapes that answer.
 *
 * Deliberately does NOT carry a separate "alreadyKnown" field —
 * anchorEvidence already IS what's known; a second field would just
 * duplicate it under another name. Deliberately does NOT carry a
 * separate "provenance" field either — epistemicStance already encodes
 * that distinction (hypothesis/open-probe vs user-stated).
 */
export type OpenDimensionKind =
  /** The target ContextElement itself has no further named facet yet —
   *  covers both a still-thin single element (expand-hypothesis) and an
   *  element that was just updated this turn (confirm-update): either
   *  way, the legitimate next move is elaborating THIS SAME element,
   *  not inventing a new one. */
  | "same-element-elaboration"
  /** A genuinely separate, real element or relation is on the table
   *  alongside the target, not yet connected/explored (probe-connection,
   *  or an inferred — never user-stated — relation via explore-relation).
   *  Reused for both: exploring an inferred relation and probing an
   *  unconnected pair of elements are the same category of legitimate
   *  open question ("how do these two relate"), just with a stronger or
   *  weaker signal behind it. */
  | "other-element"
  /** Targets a real UnresolvedPoint the provider itself marked
   *  NOT_DECIDABLE (explore-unresolved). */
  | "unresolved"
  /** No Hypothesis, relation, or unresolved point exists yet to target
   *  — anchors on raw Evidence only (expand-evidence). */
  | "raw-evidence";

export type GroundedForwardIntent = {
  /** Verbatim grounding text — what is already known, never re-derived
   *  or paraphrased. = QuestionDecision.evidenceRefs[0]. */
  anchorEvidence: string;
  openDimension: {
    kind: OpenDimensionKind;
    /** A fact, never a question string — same discipline as
     *  UnresolvedPoint.reason (context/types.ts). Built only from
     *  fields QuestionDecision already carries (hypothesisStatement,
     *  updateContext, relationContext, connectionContext, elementKind,
     *  reason) — never a fresh interpretation of the evidence. */
    description: string;
  };
  /** ContextElement.id / UnresolvedPoint.id / ContextRelation.id, when
   *  this intent targets one of the graph's real, addressable things —
   *  the same id decideQuestion()'s own priorProbedRefs already tracks
   *  for repetition protection. = QuestionDecision.hypothesisRef. */
  targetRef?: string;
  /** = QuestionDecision.epistemicStance, unchanged. */
  epistemicStance: EpistemicStance;
};

/**
 * Grounded Forward Intent Gate 1 — pure re-shaping of an already-
 * computed QuestionDecision, no new graph read, no new LLM call, no
 * keyword table. Returns null for the two intents that are correctly
 * NOT forward-opening by design (acknowledge-uncertainty, confirm-
 * change): pressing further after an uncertain admission or a
 * correction is exactly what decideResponse()'s own acknowledge-
 * uncertainty/acknowledge-correction modes already refuse to do, for
 * the same psychological-safety reason — a null intent here says
 * "nothing here is legitimate to open further," not "this failed."
 *
 * Not wired into decideResponse()/responsePhraser.ts/controller.ts this
 * Gate — this function exists to be called directly (see the Gate's own
 * validation script) so the intent shape can be inspected before any
 * live-path wiring is attempted.
 */
export function toGroundedForwardIntent(decision: QuestionDecision): GroundedForwardIntent | null {
  const anchorEvidence = decision.evidenceRefs[0] ?? "";

  switch (decision.intent) {
    case "acknowledge-uncertainty":
    case "confirm-change":
      return null;

    case "confirm-update": {
      const uc = decision.updateContext;
      return {
        anchorEvidence,
        openDimension: {
          kind: "same-element-elaboration",
          description: uc
            ? `"${decision.hypothesisStatement}" (${uc.targetKind}) was just updated (${uc.updateKind}) — no further facet beyond this has been named yet`
            : `"${decision.hypothesisStatement}" was just updated — no further facet beyond this has been named yet`,
        },
        targetRef: decision.hypothesisRef,
        epistemicStance: decision.epistemicStance,
      };
    }

    case "explore-relation": {
      const rc = decision.relationContext;
      return {
        anchorEvidence,
        openDimension: {
          kind: "other-element",
          description: rc
            ? `"${rc.fromStatement}" (${rc.fromKind}) and "${rc.toStatement}" (${rc.toKind}) have an inferred, not-yet-probed relation between them`
            : decision.reason,
        },
        targetRef: decision.hypothesisRef,
        epistemicStance: decision.epistemicStance,
      };
    }

    case "probe-connection": {
      const cc = decision.connectionContext;
      return {
        anchorEvidence,
        openDimension: {
          kind: "other-element",
          description: cc
            ? `"${cc.newerStatement}" (${cc.newerKind}) and "${cc.olderStatement}" (${cc.olderKind}) are both stated, not yet connected`
            : decision.reason,
        },
        targetRef: decision.hypothesisRef,
        epistemicStance: decision.epistemicStance,
      };
    }

    case "explore-unresolved": {
      return {
        anchorEvidence,
        openDimension: {
          kind: "unresolved",
          description: decision.hypothesisStatement ?? decision.reason,
        },
        targetRef: decision.hypothesisRef,
        epistemicStance: decision.epistemicStance,
      };
    }

    case "expand-hypothesis": {
      return {
        anchorEvidence,
        openDimension: {
          kind: "same-element-elaboration",
          description: `"${decision.hypothesisStatement}" (${decision.elementKind}) is the only active element so far, with no other named facet yet`,
        },
        targetRef: decision.hypothesisRef,
        epistemicStance: decision.epistemicStance,
      };
    }

    case "expand-evidence":
      return {
        anchorEvidence,
        openDimension: { kind: "raw-evidence", description: decision.reason },
        targetRef: undefined,
        epistemicStance: decision.epistemicStance,
      };
  }
}

/* =========================================================
 * NEXT GATE — Response-Centered Conversation Core.
 *
 * §5 audit verdict on everything above this line, in one place:
 *
 * - probe-connection, explore-relation: REPLACE as the default path.
 *   Both surface HRI's own inference AS THE QUESTION ITSELF — exactly
 *   the two patterns this Gate's §2 names and bans ("~와 연결되어 있는
 *   것 같은데, 맞을까요?" / "둘 사이에 어떤 연결이 있을까요?"). The
 *   underlying signal (ContextGraph has an update/relation) is still
 *   real Understanding — see acknowledge-continuity below, which uses
 *   the SAME `acceptedUpdatesThisTurn` signal confirm-update used, but
 *   turns it into a plain acknowledgment of two verbatim things
 *   instead of a question that asks the user to confirm or analyze a
 *   relationship. explore-relation's data (graph.relations) is kept
 *   fully intact in ContextGraph — just not surfaced by default.
 * - confirm-update: REUSE DIFFERENTLY — the update-detection signal is
 *   exactly right; only its old surfacing (a hedge-confirmation
 *   question) is replaced by acknowledge-continuity.
 * - expand-hypothesis, expand-evidence, acknowledge-uncertainty,
 *   explore-unresolved: REUSE DIFFERENTLY / KEEP as the rare
 *   `questionFallback` path (mode "ask" below) — Question is no longer
 *   the default engine (§0/§7), but the machinery (including
 *   EpistemicStance, which remains exactly as valuable for the rare
 *   case a real Question is asked) is not deleted.
 * - QuestionDecision, EpistemicStance: KEEP, unchanged, nested inside
 *   ResponseDecision.questionFallback only.
 * - ContextRelation / ContextGraph / Semantic Context Interpreter
 *   grounding (../context/): KEEP, fully unchanged — this Gate's whole
 *   premise (§9) is that deep internal Understanding is valuable and
 *   must be preserved; only what reaches the user changes.
 * - Reflection (reflectionComposer.ts): audited (Gate report §8) —
 *   NOT merged with per-turn Response. A per-turn Response reacts to
 *   the SINGLE latest turn; Reflection synthesizes the WHOLE session
 *   at a natural close. Renaming Response to "Turn Reflection" would
 *   blur that distinction without any functional benefit — kept
 *   separate, reflectionComposer.ts untouched.
 * ========================================================= */

/**
 * Response is now the default conversational engine (§0/§1). Exactly
 * four real modes plus one rare technical fallback — deliberately
 * simpler than QuestionIntent's seven branches above, because under
 * Restraint (§1.B) the Response almost never needs to pick a DIFFERENT
 * piece of Understanding to talk about: it (almost) always speaks to
 * the evidence the user just gave, in one of four postures.
 */
export type ResponseMode =
  /** Plain reflective acknowledgment of the latest evidence — the
   *  default, ordinary-turn case. */
  | "acknowledge"
  /** This turn's evidence continues/specifies a prior one (the same
   *  signal confirm-update used). The Response may name BOTH verbatim
   *  pieces in one natural sentence, but must never assert or ask
   *  about HOW they relate — see responsePhraser.ts's ban list. */
  | "acknowledge-continuity"
  /** Evidence is a correction (reused questionCorePrototype.ts marker
   *  check) — accepted naturally, not re-litigated or questioned. */
  | "acknowledge-correction"
  /** Evidence marked uncertain (reused marker check) — accepted as-is,
   *  without pressing for resolution. */
  | "acknowledge-uncertainty"
  /** Rare technical fallback ONLY (§7: "Question을 매 turn 반드시
   *  생성해야 한다고 가정하지 마라") — this Gate's decideResponse() never
   *  constructs this mode; it exists so the type can still carry a
   *  QuestionDecision if a future Gate finds a genuine, careful use
   *  for it. Never wired to relation-analysis/reason-demanding/
   *  priority-forcing/choice-forcing content (§7's four bans). */
  | "ask";

export type ResponseDecision = {
  id: string;
  turn: number;
  mode: ResponseMode;
  /** Verbatim Evidence text(s) safe to reference directly — always the
   *  literal source, never a paraphrase computed here. */
  evidenceRefs: string[];
  /** acknowledge-continuity only: the earlier verbatim evidence being
   *  named alongside the latest one. Still just quoted text — never a
   *  claim about why/how it connects to the latest evidence. */
  priorEvidenceRef?: string;
  /**
   * Reality Selection Gate — acknowledge-continuity only, populated
   * directly from this turn's own acceptedUpdatesThisTurn entry (same
   * shape QuestionDecision.updateContext already used). Unlike
   * internalNote below, THIS field is real, usable data:
   * responsePhraser.ts reads updateKind/identityRelation to let the
   * Response name the ALREADY-VALIDATED shape of the update (it became
   * more specific / it changed from an earlier state / it recurred /
   * it's in tension with the earlier point) — never a NEW causal claim,
   * emotion, or relation the interpreter didn't already accept.
   */
  updateContext?: UpdateContext;
  /**
   * Reality Selection Gate — a plain count of currently-active
   * ContextElements in this session's graph at decision time.
   * Observation metadata ONLY: it says "other Reality Points exist",
   * never which ones, never how they relate, never that they connect to
   * THIS turn's evidence. Not a relation, not a Link. responsePhraser.ts
   * does not read this field this Gate — it exists so the fact is
   * available for audit/future use without discarding it outright.
   */
  otherActiveRealityCount?: number;
  /**
   * §9's internal/external asymmetry, made an explicit field: whatever
   * deeper Understanding (a Hypothesis, an unused ContextRelation)
   * informed picking THIS evidence is recorded here for audit/devLog
   * only. responsePhraser.ts never receives this field and the rendered
   * Response text must never assert its content — see intelligenceCore.
   * ts's decideResponse(). Reality Selection Gate: the update's own
   * kind/identityRelation moved OUT of this field and into
   * updateContext above, which IS passed to the phraser — internalNote
   * still carries the free-text note for humans reading devLog.
   */
  internalNote?: string;
  reason: string;
  providerStatus: ProviderStatus;
  /** Populated only when mode === "ask" (see that mode's own doc). */
  questionFallback?: QuestionDecision;
  /**
   * Grounded Forward Intent Gate 2 — populated only when mode === "ask",
   * built directly from the SAME data each ask-branch already used to
   * decide to ask (decideResponse() in intelligenceCore.ts) — never via
   * decideQuestion()'s probe-connection/explore-relation branches, which
   * stay exactly as unsurfaced-by-default as the NEXT GATE report left
   * them (see this file's own header comment on that verdict). This is
   * the WHAT authority responsePhraser.ts reads for mode "ask": it may
   * ask about openDimension.description and nothing else — wording/
   * shape/acknowledgement amount stays the phraser's own freedom.
   */
  groundedForwardIntent?: GroundedForwardIntent;
  /**
   * First Conversation Survival Gate 1 — set only for the two narrow,
   * deterministic KO-only meta cases (the user doesn't know what to
   * write; the user is giving Reality Feedback about HRI's own
   * response latency) where the exact wording is fixed and MUST NOT
   * risk drifting into a question via an LLM call. When present,
   * advanceIntelligence() (intelligenceCore.ts) uses this text
   * verbatim as renderedText and skips phraseResponse/phraseQuestion
   * entirely — mode still describes the decision's shape (always
   * "acknowledge" for these) for devLog/audit purposes only.
   */
  directText?: string;
};
