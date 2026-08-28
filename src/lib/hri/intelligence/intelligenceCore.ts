/**
 * HRI Intelligence Core — Prototype 1 (Gate 26), Question Quality pass
 * (Gate 27-29), Response-Centered Conversation Core ("NEXT GATE").
 *
 * §0/§1 of the NEXT GATE report: HRI's default conversational engine is
 * now Response, not Question. The flow is Evidence -> Understanding ->
 * decideResponse() -> Natural Response -> user reaction -> new
 * Evidence. decideQuestion()/renderProbeTemplate()/questionPhraser.ts
 * (Gate27-29) are KEPT, unmodified, as the machinery behind the rare
 * `mode: "ask"` fallback (see ResponseDecision.questionFallback in
 * types.ts) — decideResponse() below never constructs that mode itself
 * this Gate (§7: "Question을 매 turn 반드시 생성해야 한다고 가정하지 마라"),
 * so in practice Question no longer fires at all, by design, not by
 * omission. Reflection is out of scope — nothing here is imported by
 * reflectionComposer.ts (audited again this Gate, §8 — Response and
 * Reflection serve different, non-overlapping roles, kept separate).
 *
 * Reuse, not reinvention: Evidence storage, correction detection, and
 * uncertainty detection are the caller's job, via
 * questionCorePrototype.ts's already-validated updateEvidence() — this
 * file only receives that result. Understanding formation delegates
 * entirely to a `SemanticContextInterpreter` (../context/types.ts) plus
 * ../context/validator.ts (grounding/structural rules, V1-V10) and
 * ../context/evaluationHarness.ts (merge into ContextGraph) — ALL of
 * this stays exactly as deep and unchanged as Gate26-29 left it. What
 * changes is only what of that depth reaches the user — see
 * decideResponse()'s own doc for the internal/external asymmetry.
 */
import type { EvidenceItem } from "../v2/questionCorePrototype";
import {
  type ContextElement,
  type ContextGraph,
  type ContextRelation,
  type ConversationTurn,
  type CrossElementContinuity,
  type InterpreterOutput,
  type PreviousProposalFeedback,
  type ProposedUpdate,
  type SemanticContextInterpreter,
  summarizeGraph,
} from "../context/types";
import { validateInterpretation, validateGrounding, validateCurrentTurnGrounding, type InterpretationValidationResult } from "../context/validator";
import { mergeInterpreterOutput, filterAcceptedProposals } from "../context/evaluationHarness";
import { devLog } from "../../devLog";
import type { Locale } from "../locale";
import { phraseQuestion } from "./questionPhraser";
import { phraseResponse, type ResponseCallStat } from "./responsePhraser";
import {
  hypothesesFromGraph,
  type ConnectionContext,
  type Hypothesis,
  type ProviderStatus,
  type QuestionDecision,
  type ResponseDecision,
  type UpdateContext,
} from "./types";

export type { Hypothesis, QuestionDecision, ResponseDecision, ProviderStatus } from "./types";

/** Bounded window, same size ../context/evaluationHarness.ts itself
 *  uses (RECENT_TURNS_WINDOW) — never the full conversation. */
const RECENT_TURNS_WINDOW = 4;

export type AdvanceIntelligenceInput = {
  priorGraph: ContextGraph;
  priorProbedRefs: string[];
  priorProposalFeedback?: PreviousProposalFeedback;
  /** All turns so far, oldest first — this function windows it itself. */
  allTurns: ConversationTurn[];
  newEvidence: EvidenceItem;
  wasCorrection: boolean;
  supersededEvidenceText?: string;
  turn: number;
  interpreter: SemanticContextInterpreter;
  /** Multilingual Gate — drives decideResponse's marker detection and
   *  phraseResponse's prompt/validator. Never read by the interpreter
   *  itself (contextFirstSemanticAdapter.ts is already language-agnostic
   *  by its own Rule 0: "same language as the source turns"). */
  locale: Locale;
};

export type AdvanceIntelligenceResult = {
  graph: ContextGraph;
  probedRefs: string[];
  proposalFeedback: PreviousProposalFeedback;
  /** NEXT GATE — was QuestionDecision; now ResponseDecision, the
   *  primary decision type. See types.ts. */
  decision: ResponseDecision;
  renderedText: string;
  /** "provider" when responsePhraser.ts's own call produced and passed
   *  validation; "template" when it was skipped/failed and the
   *  deterministic renderer was used instead. Never hidden — always
   *  reported so wording quality is auditable per-turn. */
  wordingSource: "provider" | "template";
  hypotheses: Hypothesis[];
};

/**
 * Gate 27 §13 — correction ownership, root-caused. Gate 26 always ran
 * this deterministic bridge AND let the provider independently propose
 * its own update for the same correction turn, producing duplicate
 * evidenceRefs on the same element (Gate 26 §O.4). The fix is not to
 * delete either path — it is to make this bridge a FALLBACK: it only
 * fires for elements the provider's OWN placements this turn did NOT
 * already address. Ownership is now explicit: the deterministic marker
 * check (questionCorePrototype.ts) owns the AUTHORITATIVE EVENT ("a
 * correction happened, evidence X was superseded") — it always runs
 * and is always trustworthy. WHICH element(s) change and HOW is the
 * provider's judgment when the provider actually addresses it; this
 * function only steps in when the provider didn't.
 */
function buildCorrectionUpdates(
  graph: ContextGraph,
  supersededText: string,
  newEvidence: EvidenceItem,
  turn: number,
  alreadyCoveredTargetIds: ReadonlySet<string>,
): ProposedUpdate[] {
  const targets = graph.elements.filter(
    (e) => e.active && !alreadyCoveredTargetIds.has(e.id) && e.evidenceRefs.some((r) => r.sourceText === supersededText),
  );
  return targets.map((t) => ({
    targetElementId: t.id,
    kind: "revise",
    identityRelation: "revision",
    impliedElementKind: t.kind,
    note: "superseded by a correction turn — provider did not address this element itself this turn, deterministic fallback applied",
    groundingTurn: turn,
    groundingText: newEvidence.text,
    confidence: 1,
  }));
}

/** Local re-implementation of evaluationHarness.ts's private
 *  buildPreviousProposalFeedback — that function is not exported. */
function buildProposalFeedback(validation: InterpretationValidationResult): PreviousProposalFeedback {
  const acceptedRefs: string[] = [];
  const rejectedRefs: string[] = [];
  const uncertainRefs: string[] = [];
  const reasons: string[] = [];

  const record = (ref: string, decision: string, issues: { message: string }[]) => {
    if (decision === "REJECT") rejectedRefs.push(ref);
    else if (decision === "ACCEPT_WITH_UNCERTAINTY") uncertainRefs.push(ref);
    else acceptedRefs.push(ref);
    reasons.push(...issues.map((i) => i.message));
  };

  for (const n of validation.newElements) record(n.proposal.localRef, n.decision, n.issues);
  for (const u of validation.updatedElements) record(u.proposal.targetElementId, u.decision, u.issues);
  for (const r of validation.relations) record(`${r.proposal.from}->${r.proposal.to}`, r.decision, r.issues);

  return { acceptedRefs, rejectedRefs, uncertainRefs, reasons: reasons.slice(0, 8) };
}

const INFO_GAIN_RANK: Record<"low" | "medium" | "high", number> = { low: 1, medium: 2, high: 3 };

function elementById(graph: ContextGraph, id: string): ContextElement | undefined {
  return graph.elements.find((e) => e.id === id);
}

/**
 * Shadow Validation Prototype — checks a raw crossElementContinuity
 * signal against the SAME V1 (validateGrounding) / V8
 * (validateCurrentTurnGrounding) rules already applied to relations[]/
 * placements[] elsewhere in this pipeline, plus the same real-element
 * re-check decideResponse() already performs on the raw signal today.
 * Observation only: never mutates `graph`, never changes what
 * decideResponse() receives (updateGraph() below still returns the RAW,
 * unvalidated signal, unchanged — see its own comment), never persisted.
 * No connective/keyword list — the ONLY new check is "is this quote real
 * text from this turn", never "does it contain word X".
 */
function shadowValidateCrossElementContinuity(
  raw: CrossElementContinuity | undefined,
  graph: ContextGraph,
  recentTurns: ConversationTurn[],
  turn: number,
): { result: "no-signal" | "accepted" | "rejected"; reason: string } {
  if (!raw) return { result: "no-signal", reason: "no crossElementContinuity in this turn's output" };

  if (!raw.groundingQuote || !raw.groundingQuote.trim()) {
    return { result: "rejected", reason: "groundingQuote missing or empty" };
  }

  const groundingIssues = [
    ...validateGrounding(turn, raw.groundingQuote, recentTurns),
    ...validateCurrentTurnGrounding(turn, turn, `${raw.priorElementId}->${raw.newElementLocalRef}`),
  ];
  if (groundingIssues.length > 0) {
    return { result: "rejected", reason: groundingIssues.map((i) => i.message).join("; ") };
  }

  if (!elementById(graph, raw.priorElementId)) {
    return { result: "rejected", reason: `priorElementId "${raw.priorElementId}" does not exist in the merged graph` };
  }
  if (!elementById(graph, raw.newElementLocalRef)) {
    return { result: "rejected", reason: `newElementLocalRef "${raw.newElementLocalRef}" does not exist in the merged graph` };
  }

  return { result: "accepted", reason: "groundingQuote traceable to current turn text (V1/V8); both endpoints resolve in the merged graph" };
}

/**
 * User-Stated Line Deterministic Capture Gate — the last-resort,
 * non-LLM fallback for exactly one case: the interpreter's own
 * crossElementContinuity signal (already grounding-validated by
 * shadowValidateCrossElementContinuity above — reused as-is, not
 * re-checked here) shows the user directly connecting a brand-new
 * Reality Point to a prior one in their own words, but the
 * interpreter's own relations[] (PHASE 3, same turn, same call) did
 * not also capture it as a permanent ContextRelation. Deliberately NOT
 * a new semantic classifier: every condition tested here (grounding
 * validity, both endpoints real/active, no existing relation already
 * covering them) reuses a structured signal the pipeline already
 * computes for another reason — no connective-word list, no keyword
 * table, no new LLM call.
 *
 * Always the SAFEST possible relation: type is always "relatesTo"
 * (never a stronger causal type like limits/conflictsWith/respondsTo —
 * this fallback has no basis to judge which specific type fits, only
 * that a connection exists), confidence is never upgraded beyond the
 * interpreter's own crossElementContinuity.confidence, and provenance
 * is always "user-stated" — meaning only "the user connected these two
 * things in their own words," never "A causes B" (see RelationProvenance's
 * own doc, context/types.ts). finalExperiencePhraser.ts's Grounded
 * Discovery Boundary is what keeps Reflection from overstating this
 * further downstream — this function's only job is not to lose the
 * connection before it ever reaches that boundary.
 */
function buildDeterministicUserStatedRelation(
  graph: ContextGraph,
  crossElementContinuity: CrossElementContinuity | undefined,
  shadowResult: { result: "no-signal" | "accepted" | "rejected"; reason: string },
  turn: number,
): ContextRelation | null {
  if (shadowResult.result !== "accepted" || !crossElementContinuity) return null;

  const prior = elementById(graph, crossElementContinuity.priorElementId);
  const current = elementById(graph, crossElementContinuity.newElementLocalRef);
  // Condition A/B — both endpoints must be real, ACTIVE elements in the
  // already-merged graph. shadowValidateCrossElementContinuity already
  // confirmed both ids resolve to SOME element; `active` is checked
  // here since that function does not.
  if (!prior || !prior.active || !current || !current.active) return null;

  // Condition D — never duplicate a relation the LLM's own PHASE 3
  // already captured (any type, any provenance) between these same two
  // endpoints, in either direction.
  const alreadyLinked = graph.relations.some(
    (r) => (r.from === prior.id && r.to === current.id) || (r.from === current.id && r.to === prior.id),
  );
  if (alreadyLinked) return null;

  return {
    id: `relation-fallback-${graph.relations.length + 1}`,
    type: "relatesTo",
    from: prior.id,
    to: current.id,
    evidenceRefs: [{ turn, sourceText: crossElementContinuity.groundingQuote, kind: "explicit" }],
    provenance: "user-stated",
    confidence: crossElementContinuity.confidence,
    status: "open",
  };
}

/**
 * Gate 28 §2 — true only when the element's description is still
 * exactly its own original grounding quote (the first evidenceRef, set
 * verbatim from the user's text when the element was created — see
 * contextFirstSemanticAdapter.ts's toInterpreterOutput comment on why
 * description = groundingQuote, never a separately generated field).
 * mergeInterpreterOutput appends " (note)" to description on every
 * update, so any update at all breaks this equality — a plain string
 * comparison, not a semantic judgment, is enough to tell "still just
 * what the user said" apart from "HRI has layered a reading on top".
 */
function isStillVerbatim(element: ContextElement): boolean {
  const original = element.evidenceRefs[0]?.sourceText;
  return original !== undefined && element.description === original;
}

/**
 * KEPT, unmodified in behavior, per the NEXT GATE report §5 verdict on
 * QuestionDecision ("KEEP, unchanged, nested inside
 * ResponseDecision.questionFallback only"). decideResponse() below
 * never calls this function this Gate — Question is no longer
 * generated at all in practice (§7) — but the machinery (including
 * probe-connection/explore-relation, which the same report's §5 marked
 * REPLACE as a *default* path, not deleted) is preserved exported here
 * for a future Gate that finds a genuine, carefully-scoped use for a
 * real Question again.
 *
 * Gate 27 §5/§6, restructured Gate 29 §3 around three explicit
 * questions ("WHAT CHANGED? WHAT IS CONNECTED? WHAT REMAINS OPEN?") —
 * Question Decision layer ("what to ask"), separate from wording
 * (questionPhraser.ts / renderProbeTemplate, "how to phrase it").
 * Priority order, highest first:
 *
 *   1. uncertainty (reused marker, deterministic) — overrides everything.
 *   2. correction (reused marker, deterministic) — overrides Hypothesis choice.
 *   3. confirm-update — WHAT CHANGED. THIS TURN's own accepted output
 *      updated an existing element, checked before any probed-history
 *      filtering (Gate 27 §9): the change itself, not the element's
 *      probe history, is what's being asked about.
 *   4. explore-relation — WHAT IS CONNECTED, provider-asserted case: a
 *      real ContextRelation the provider itself proposed, not yet
 *      probed.
 *   5. explore-unresolved — WHAT REMAINS OPEN: a point the provider
 *      itself marked NOT_DECIDABLE, not yet probed.
 *   6. probe-connection / expand-hypothesis — WHAT IS CONNECTED,
 *      general case (Gate 29's central fix): Gate 29's own audit of
 *      CASE A/B found `graph.relations` EMPTY on every turn of both —
 *      step 4 above is real but rarely reachable. This step does not
 *      wait for the provider to assert a relation: whenever the
 *      newest not-yet-probed active element has ANY other active
 *      element to serve as a partner, it asks — openly, without
 *      asserting a connection — whether/how the two relate. Only
 *      when no partner exists at all (exactly one element in the
 *      whole graph — the genesis turn) does this fall through to
 *      expand-hypothesis, now a true single-element fallback.
 *   7. expand-evidence — final fallback, honestly labeled.
 */
export function decideQuestion(args: {
  graph: ContextGraph;
  newEvidence: EvidenceItem;
  wasCorrection: boolean;
  priorProbedRefs: string[];
  turn: number;
  providerStatus: ProviderStatus;
  acceptedUpdatesThisTurn: ProposedUpdate[];
}): QuestionDecision {
  const { graph, newEvidence, wasCorrection, priorProbedRefs, turn, providerStatus, acceptedUpdatesThisTurn } = args;
  const probedSet = new Set(priorProbedRefs);

  if (newEvidence.certainty === "uncertain") {
    return {
      id: `iq${turn}`, turn, intent: "acknowledge-uncertainty", epistemicStance: "open-probe",
      evidenceRefs: [newEvidence.text],
      reason: "evidence marked uncertain (reused questionCorePrototype.ts marker check) — not promoted to a Hypothesis",
      providerStatus,
    };
  }

  if (wasCorrection) {
    return {
      id: `iq${turn}`, turn, intent: "confirm-change", epistemicStance: "user-stated",
      evidenceRefs: [newEvidence.text],
      reason: "evidence is a correction (reused questionCorePrototype.ts marker check)",
      providerStatus,
    };
  }

  // 3) confirm-update — real change from THIS turn, checked before any
  // probed-history filtering (Gate 27 §9).
  if (acceptedUpdatesThisTurn.length > 0) {
    const u = [...acceptedUpdatesThisTurn].sort((a, b) => b.confidence - a.confidence)[0];
    const target = elementById(graph, u.targetElementId);
    if (target) {
      const updateContext: UpdateContext = {
        targetKind: target.kind,
        updateKind: u.kind,
        identityRelation: u.identityRelation,
        note: u.note,
      };
      return {
        id: `iq${turn}`, turn, intent: "confirm-update", epistemicStance: "hypothesis",
        evidenceRefs: [u.groundingText],
        hypothesisRef: target.id,
        hypothesisStatement: target.description,
        updateContext,
        reason: `this turn's evidence ${u.identityRelation} (${u.kind}) existing hypothesis "${target.id}": ${u.note}`,
        providerStatus,
      };
    }
  }

  // 4) explore-relation — real provider output, previously never read.
  const openRelations = graph.relations
    .filter((r) => r.status === "open" && !probedSet.has(r.id))
    .sort((a, b) => b.confidence - a.confidence);
  if (openRelations.length > 0) {
    const r = openRelations[0];
    const from = elementById(graph, r.from);
    const to = elementById(graph, r.to);
    if (from && to) {
      const latestGrounding = r.evidenceRefs[r.evidenceRefs.length - 1];
      return {
        id: `iq${turn}`, turn, intent: "explore-relation", epistemicStance: "hypothesis",
        evidenceRefs: [latestGrounding?.sourceText ?? newEvidence.text],
        hypothesisRef: r.id,
        relationContext: { relationType: r.type, fromKind: from.kind, fromStatement: from.description, toKind: to.kind, toStatement: to.description },
        // User-Stated Relation Gate — provenance can now be "inferred" or
        // "user-stated" (context/types.ts); this dead branch (see this
        // file's header — decideResponse() never calls decideQuestion())
        // still treats every relation as Hypothesis-stance regardless of
        // provenance, unchanged from before that field existed.
        reason: `relation "${r.id}" (${from.kind} ${r.type} ${to.kind}, confidence=${r.confidence}, provenance=${r.provenance}) not yet probed`,
        providerStatus,
      };
    }
  }

  // 5) explore-unresolved — unchanged from Gate 26.
  const openUnresolved = graph.unresolved
    .filter((u) => !probedSet.has(u.id))
    .sort((a, b) => INFO_GAIN_RANK[b.potentialInformationGain] - INFO_GAIN_RANK[a.potentialInformationGain]);
  if (openUnresolved.length > 0) {
    const u = openUnresolved[0];
    const grounding = u.grounding[u.grounding.length - 1];
    return {
      id: `iq${turn}`, turn, intent: "explore-unresolved", epistemicStance: "open-probe",
      evidenceRefs: [grounding?.sourceText ?? newEvidence.text],
      hypothesisRef: u.id, hypothesisStatement: u.reason,
      reason: `unresolved point "${u.id}" (potentialInformationGain=${u.potentialInformationGain}) not yet probed: ${u.reason} — the provider itself marked this NOT_DECIDABLE, so this is Open-Probe, not Hypothesis, stance`,
      providerStatus,
    };
  }

  // 6) probe-connection / expand-hypothesis — Gate 29: pick the newest
  // not-yet-probed active element as the target (unchanged "fresh
  // first" ordering); THEN check whether any OTHER active element
  // exists to serve as a connection partner. If one does, this becomes
  // a probe-connection (open, non-asserting — WHAT IS CONNECTED,
  // without waiting for a rare provider-asserted relation). Only when
  // no partner exists at all (the genesis turn — exactly one element
  // in the whole graph) does this fall through to expand-hypothesis,
  // now a true single-element fallback, not the dominant branch.
  const activeElements = graph.elements
    .filter((e) => e.active && !probedSet.has(e.id))
    .sort((a, b) => {
      const aTurn = a.evidenceRefs[a.evidenceRefs.length - 1]?.turn ?? 0;
      const bTurn = b.evidenceRefs[b.evidenceRefs.length - 1]?.turn ?? 0;
      if (aTurn !== bTurn) return bTurn - aTurn;
      return b.confidence - a.confidence;
    });
  if (activeElements.length > 0) {
    const e = activeElements[0];
    const partner = graph.elements
      .filter((other) => other.active && other.id !== e.id)
      .sort((a, b) => {
        const aTurn = a.evidenceRefs[a.evidenceRefs.length - 1]?.turn ?? 0;
        const bTurn = b.evidenceRefs[b.evidenceRefs.length - 1]?.turn ?? 0;
        return bTurn - aTurn;
      })[0];

    if (partner) {
      const connectionContext: ConnectionContext = {
        newerKind: e.kind, newerStatement: e.description,
        olderKind: partner.kind, olderStatement: partner.description,
      };
      return {
        id: `iq${turn}`, turn, intent: "probe-connection", epistemicStance: "open-probe",
        evidenceRefs: [e.description, partner.description],
        hypothesisRef: e.id,
        connectionContext,
        reason: `newest active element "${e.id}" (kind=${e.kind}) and older active element "${partner.id}" (kind=${partner.kind}) have no provider-asserted relation between them — asking openly whether/how they connect, without asserting a connection exists`,
        providerStatus,
      };
    }

    const stillVerbatim = isStillVerbatim(e);
    return {
      id: `iq${turn}`, turn, intent: "expand-hypothesis",
      epistemicStance: stillVerbatim ? "user-stated" : "hypothesis",
      evidenceRefs: e.evidenceRefs.map((r) => r.sourceText),
      hypothesisRef: e.id, hypothesisStatement: e.description, elementKind: e.kind,
      reason: `hypothesis "${e.id}" (kind=${e.kind}, confidence=${e.confidence}) is the only active element so far — no partner to connect it to yet. ${stillVerbatim ? "description is still exactly the original grounding quote (User-Stated)" : "description has accumulated an update note beyond the original quote (Hypothesis)"}`,
      providerStatus,
    };
  }

  // 7) fallback — raw Evidence, always safe to reference directly.
  return {
    id: `iq${turn}`, turn, intent: "expand-evidence", epistemicStance: "user-stated",
    evidenceRefs: [newEvidence.text],
    reason: providerStatus === "unavailable"
      ? "no Hypothesis available — semantic provider unavailable, falling back to evidence-anchored expand (NOT a keyword-based judgment)"
      : "no Hypothesis, relation, or unresolved point has been formed from this evidence yet",
    providerStatus,
  };
}

/**
 * Deterministic fallback wording — same "dash-quote aside" grammar-
 * safety pattern as questionCorePrototype.ts's TEMPLATES: every Korean
 * particle attaches to a FIXED preceding word, never directly to
 * quoted user text. Gate 27 §11 no longer treats this as the primary
 * wording path (see phraseQuestion in questionPhraser.ts) — it is the
 * always-available safety net when that call is unavailable or its
 * output fails validation, so it deliberately stays simple/repetitive-
 * looking rather than trying to out-write a real language model; this
 * repetitiveness is now the DEGRADED path, not the everyday one.
 */
export function renderProbeTemplate(decision: QuestionDecision): string {
  const quote = (s: string) => `'${s}'`;
  const first = decision.evidenceRefs[0] ?? "";
  switch (decision.intent) {
    case "acknowledge-uncertainty":
      return `방금 하신 말씀 — ${quote(first)} — 은 지금 뚜렷하게 설명하기 어려우신 것 같아요. 그래도 지금 마음에 걸리는 게 있다면 편하게 말씀해 주세요.`;
    case "confirm-change":
      return `방금 정정해 주신 내용 — ${quote(first)} — 을 기준으로 다시 여쭤볼게요. 지금 가장 걸리는 부분은 무엇인가요?`;
    case "confirm-update":
      return `방금 하신 말씀 — ${quote(first)} — 으로 앞서 하신 이야기가 조금 달라진 것 같습니다. 지금은 어떻게 보이시나요?`;
    case "explore-relation":
      return `방금 하신 말씀 — ${quote(first)} — 이 앞서 말씀하신 것과 어떻게 이어지는지 조금 더 들려주시겠어요?`;
    case "probe-connection": {
      const other = decision.evidenceRefs[1] ?? "";
      return `방금 하신 말씀 — ${quote(first)} — 이 앞서 하신 말씀 — ${quote(other)} — 과 이어지는 부분이 있을까요?`;
    }
    case "explore-unresolved":
      return `지금까지 하신 말씀 중 — ${quote(first)} — 부분이 아직 더 여쭤볼 여지가 있어 보입니다. 이 부분에 대해 조금 더 말씀해 주시겠어요?`;
    case "expand-hypothesis":
      return `방금 하신 말씀 — ${quote(first)} — 에서, 조금 더 떠오르는 것이 있다면 무엇인가요?`;
    case "expand-evidence":
    default:
      return `방금 하신 말씀 — ${quote(first)} — 에서, 조금 더 떠오르는 것이 있다면 무엇인가요?`;
  }
}

/**
 * Conversation Question Quality Gate — root cause was structural, not
 * a prompt problem (see this file's own header, §7 of NEXT GATE:
 * decideResponse below never constructed mode:"ask" at all, by design
 * — Question "no longer fires... not by omission"). Real 4-turn CASEs
 * (건설 공사 수주 등) showed this meant 3-4 consecutive acknowledge/
 * acknowledge-continuity turns with zero information gain — textbook
 * ECHO. These two marker lists are the deterministic, evidence-grounded
 * triggers for the two real gaps found: a HEDGE the user voiced
 * without stating its basis, and a bare CONFIRMATION that adds no new
 * content to acknowledge. Same small-literal-marker-list precedent as
 * questionCorePrototype.ts's UNCERTAIN_MARKERS/CORRECTION_MARKERS
 * (checked for overlap — none) — deliberately not a fuzzy/NLP
 * classifier, and deliberately NOT the old decideQuestion() probe-
 * connection/explore-relation machinery, which the NEXT GATE report
 * already banned for exactly the "assert a connection, ask user to
 * confirm/explain it" pattern this Gate reaffirms banning (see
 * responsePhraser.ts's MODE_RULES.ask and its now-shared validation).
 */
const HEDGE_MARKERS: Record<Locale, string[]> = {
  ko: ["아마", "것 같다", "것같다", "것 같아", "것같아", "인가보다", "인가 보다", "일지도", "듯하다", "듯 하다", "듯싶다"],
  // Multilingual Gate — Japanese hedge candidates named directly in the
  // Beta Handoff (§6/§14 CASE J1/J2): たぶん/おそらく (maybe/probably),
  // かもしれない (might be), 〜ような気がする/気がする (feels like/have a
  // feeling that), 〜と思う (I think), 〜だろう/でしょう (probably/I
  // suppose) — same "guess without stated basis" concept as the Korean
  // set, not a word-for-word translation of it.
  ja: ["たぶん", "おそらく", "かもしれない", "ような気がする", "な気がする", "気がする", "と思う", "だろう", "でしょう"],
  // Multilingual Gate — English, matched case-insensitively (see
  // hasHedge below). Directly from the Beta Handoff's own English
  // hedge candidate list (§6).
  en: ["maybe", "perhaps", "probably", "i think", "i guess", "it seems", "i feel like", "might", "could be"],
};
/** English is matched case-insensitively — Latin script varies case
 *  naturally in a way Korean/Japanese do not; ko/ja stay exactly as
 *  before this Gate (raw, case-sensitive substring match). */
function hasHedge(text: string, locale: Locale): boolean {
  const cmp = locale === "en" ? text.toLowerCase() : text;
  return HEDGE_MARKERS[locale].some((m) => cmp.includes(m));
}

// HRI Architecture Fix Gate — CONFIRMATION_ONLY_MARKERS/isConfirmationOnly
// moved to questionCorePrototype.ts (not duplicated): Conversation Act is
// now decided once, at Evidence-creation time, and stored on
// EvidenceItem.act. decideResponse below reads that tag directly instead
// of re-scanning newEvidence.text a second time with a second copy of the
// same marker list.

/**
 * First Conversation Survival Gate 1 (CASE 1) — narrow, deterministic
 * markers for the user expressing difficulty with WHAT TO WRITE (a
 * meta statement about the input task itself — "I don't know what to
 * write" — not life content). Root-caused via decideResponse()/
 * responsePhraser.ts trace: this kind of turn had no dedicated branch,
 * so it fell through to the turn===1 "ask" branch or the generic
 * hedge/confirmation "ask" shapes below, each of which grounds its
 * question in evidenceRefs=[the user's own confused statement] — the
 * model's most natural completion of "ask for the basis" against that
 * grounding is a circular "왜 그런지 말씀해 주시겠어요?"-shaped question,
 * exactly the reported bad response. The fix is not a wording tweak to
 * an existing ask-shape; it is recognizing this is a DIFFERENT kind of
 * turn (about the tool, not about the user's life) that should never
 * become a question. KO only this Gate (multilingual explicitly out
 * of scope — see hasInputGuidanceNeed's locale guard) — ja/en take
 * the exact same path as before this Gate, byte-identical.
 */
const INPUT_GUIDANCE_MARKERS_KO = [
  "무엇을 적어야", "뭘 적어야", "무엇을 써야", "뭘 써야", "무얼 적어야", "무얼 써야",
  "적어야 할지 모르", "써야 할지 모르", "적어야 할지 망설", "써야 할지 망설",
  "뭘 말해야 할지 모르", "무엇을 말해야 할지 모르", "뭐라고 써야",
];

function hasInputGuidanceNeed(text: string, locale: Locale): boolean {
  if (locale !== "ko") return false;
  return INPUT_GUIDANCE_MARKERS_KO.some((m) => text.includes(m));
}

/** Verbatim target wording from the First Conversation Survival Gate 1
 *  spec — a deterministic, non-LLM response (see ResponseDecision.
 *  directText's own doc for why this must not go through an LLM call
 *  at all): permission + a concrete, topic-agnostic starting point,
 *  never another question. */
const INPUT_GUIDANCE_RESPONSE_KO =
  "특별한 주제를 정하지 않아도 됩니다. 지금 가장 먼저 떠오르는 일이나 기분부터 적어보세요.";

/**
 * First Conversation Survival Gate 1 (CASE 2) — narrow, deterministic
 * detection for the user giving Reality Feedback about HRI's OWN
 * response latency ("반응이 5초 정도 걸린다", "좀 빨리 반응이 오면
 * 좋겠다"), not describing their own reaction/psychology. Root-caused
 * the same way as CASE 1: this evidence had no dedicated branch, so it
 * fell to plain "acknowledge", whose natural-language reflection of
 * "반응"+"시간이 걸린다" reads as if the SUBJECT were the user ("반응하는
 * 데 시간이 걸리시는군요") — a subject-attribution error, not a wording
 * quality issue. Requires BOTH a reaction/response-time SUBJECT marker
 * AND a speed/delay QUALITY marker in the same turn (an AND condition,
 * not either alone) so ordinary content that merely contains "반응"/
 * "응답"/"답변" for an unrelated reason does not false-positive. KO only.
 *
 * Gate 1 Runtime Mismatch fix — "답변" (reply/answer) added: a real UI
 * test ("답변이 5초 정도 걸린다") used this natural synonym for "response"
 * and this list originally only covered "반응"/"응답", so the AND
 * condition's subject half silently failed and the whole branch never
 * fired. Same quality-marker pairing as before, no other change.
 */
const LATENCY_SUBJECT_MARKERS_KO = ["반응", "응답", "답변"];
const LATENCY_QUALITY_MARKERS_KO = ["느리다", "느려", "걸린다", "걸려", "빨리", "빠르게", "빠른", "늦다", "늦어", "오래 걸"];

function hasLatencyFeedback(text: string, locale: Locale): boolean {
  if (locale !== "ko") return false;
  const hasSubject = LATENCY_SUBJECT_MARKERS_KO.some((m) => text.includes(m));
  const hasQuality = LATENCY_QUALITY_MARKERS_KO.some((m) => text.includes(m));
  return hasSubject && hasQuality;
}

/** TRUTH (§1.A) — reuses the user's own stated number when present
 *  instead of inventing one; only falls back to a number-free sentence
 *  when they didn't state a specific duration. */
function extractSecondsMention(text: string): string | null {
  const m = text.match(/(\d+)\s*초/);
  return m ? m[1] : null;
}

function buildLatencyFeedbackResponseKo(text: string): string {
  const seconds = extractSecondsMention(text);
  return seconds
    ? `답변이 나오기까지 약 ${seconds}초가 걸렸군요. 조금 더 빠른 반응을 원하시는 것으로 이해했습니다.`
    : `답변이 나오기까지 시간이 걸렸다고 느끼셨군요. 조금 더 빠른 반응을 원하시는 것으로 이해했습니다.`;
}

/**
 * Conversation Quality Gate 2 — narrow, deterministic detection of
 * plainly incomplete/still-being-typed input (real CASE: "많은 사람ㄷ").
 * Root cause traced before this fix: nothing anywhere in the pipeline
 * ever checks for this — questionCorePrototype.ts's updateEvidence()
 * accepts every turn's raw text verbatim by design ("no keyword
 * classifier decides whether to keep it"), and updateGraph() below
 * unconditionally sends it to the semantic interpreter, which happily
 * produces a confident reading of a fragment never meant to be
 * submitted as-is. The fix is not a length/terseness heuristic (Gate 1
 * explicitly warned against blocking ordinary short input, and
 * questionCorePrototype.ts's own "clarify" branch already owns terse-
 * but-complete text).
 *
 * Gate 2 Final Safety Check — the first version of this check
 * (bare `/[ㄱ-ㅣ]$/`) was too broad: it also matched intentional
 * jamo-only expressions ("ㅋㅋ", "ㅎ", "ㄷㄷ" — Korean internet-slang
 * laughter/reaction tokens with no preceding syllable at all), which
 * must never be blocked. The real, narrower signature is "a COMPLETE
 * Hangul syllable block (가-힣) immediately followed by exactly one
 * trailing CONSONANT jamo (ㄱ-ㅎ) at the very end of the string" —
 * that specific shape can only occur when a new syllable's initial
 * consonant (초성, always typed first in 2-beolsik composition) was
 * entered and Enter fired before the vowel/rest completed it (e.g.
 * "사람" + "ㄷ"). A doubled/standalone jamo run ("ㅋㅋ", "ㅎ", "ㄷㄷ")
 * never has a syllable block directly adjacent to its last character,
 * so this pattern does not match them. Vowel jamo are deliberately
 * excluded from the trailing set too — 2-beolsik composition always
 * starts a new syllable with a consonant, so a genuinely cut-off
 * syllable's leftover keystroke is never a bare vowel. KO only (this
 * signature has no equivalent in ja/en scripts) — ja/en take the
 * exact same path as before this Gate.
 *
 * Known, accepted scope limit: a single trailing consonant right
 * after a complete word (e.g. "사람들ㅋ") is inherently ambiguous
 * between "cut off mid-composition" and "a soft single-jamo
 * interjection" — this Gate's explicit required-safe list is the
 * doubled/standalone forms ("ㅋㅋ"/"ㅎ"/"ㄷㄷ"), not that single-
 * trailing-consonant-after-a-word shape, which is exactly the real
 * failure case ("많은 사람ㄷ") this check exists to catch.
 */
const TRAILING_INCOMPLETE_JAMO_RE = /[가-힣][ㄱ-ㅎ]$/;
function hasIncompleteInputSignature(text: string, locale: Locale): boolean {
  if (locale !== "ko") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  return TRAILING_INCOMPLETE_JAMO_RE.test(trimmed);
}

/** Deliberately does not quote the fragment back or guess at its
 *  content (TRUTH/RESTRAINT) — a plainly cut-off message has no
 *  content yet to react to; this only invites the user to continue. */
const INCOMPLETE_INPUT_RESPONSE_KO =
  "지금 말씀이 잠시 끊긴 것 같아요. 편하게 다시 이어서 말씀해 주세요.";

/** Most recently touched active element — same "fresh first" ordering
 *  decideQuestion()'s probe-connection branch already established
 *  (evidenceRefs[last].turn, ties broken by confidence), reproduced
 *  locally rather than importing that function, so this Gate's change
 *  stays inside decideResponse's own four-branch structure instead of
 *  reopening decideQuestion()'s seven-branch one. */
/** Reality Selection Gate — plain count, never a relation. Counts
 *  active elements other than `excludeId` (the one this turn's
 *  decision is already speaking to) so ResponseDecision can carry the
 *  fact that other Reality Points exist this session without naming
 *  which ones or how they connect. */
function countOtherActiveRealities(graph: ContextGraph, excludeId: string | undefined): number {
  return graph.elements.filter((e) => e.active && e.id !== excludeId).length;
}

function mostRecentActiveElement(graph: ContextGraph): ContextElement | undefined {
  return [...graph.elements]
    .filter((e) => e.active)
    .sort((a, b) => {
      const aTurn = a.evidenceRefs[a.evidenceRefs.length - 1]?.turn ?? 0;
      const bTurn = b.evidenceRefs[b.evidenceRefs.length - 1]?.turn ?? 0;
      if (aTurn !== bTurn) return bTurn - aTurn;
      return b.confidence - a.confidence;
    })[0];
}

/**
 * NEXT GATE — the new default decision layer ("what to say back"),
 * replacing decideQuestion() as the primary path (§0/§1/§6 of the
 * report). Priority order, highest first:
 *
 *   1. uncertainty (reused marker, deterministic) — accepted as-is.
 *   2. correction (reused marker, deterministic) — accepted as-is.
 *   3. hedge (Conversation Question Quality Gate) — the user voiced a
 *      guess/hedge ("아마", "~것 같다") without stating what led them
 *      to think so. mode:"ask", asking for the BASIS only — never
 *      asserting whether the guess is true, never inventing a feeling.
 *      Checked BEFORE continuity/plain-acknowledge on purpose: a hedge
 *      is exactly the case a plain restatement produces the clearest
 *      ECHO (see this Gate's CASE A turn 3).
 *   4. confirmation-only (Conversation Question Quality Gate) — the
 *      turn is bare agreement ("그렇다"/"맞다") with no new content of
 *      its own to acknowledge. Echoing it ("'그렇다'라고 말씀해
 *      주셨네요") is pure noise, so this asks about the most recently
 *      touched active element instead of the bare confirmation text —
 *      moving forward using EXISTING grounded context, never inventing
 *      new content to ask about.
 *   5. continuity — THIS TURN's own accepted output updated an
 *      existing element (the exact same `acceptedUpdatesThisTurn`
 *      signal confirm-update used). The prior verbatim evidence is
 *      carried as `priorEvidenceRef` so the Response can name both —
 *      it does NOT carry `updateContext`/`identityRelation` into the
 *      rendered text; that stays in `internalNote` for audit only
 *      (§9's internal/external asymmetry, enforced structurally: the
 *      phraser is never given identityRelation/updateKind at all — see
 *      responsePhraser.ts's buildUserPrompt, which only reads
 *      evidenceRefs/priorEvidenceRef).
 *      Turn 2-3 Parroting Removal Gate — but only ONCE per element:
 *      once the target has already been continuity-merged twice
 *      (evidenceRefs.length >= 3, i.e. this would be the second
 *      consecutive continuity turn on the same thread), this falls
 *      through to mode:"ask" instead — see the code below for why a
 *      plain length check on existing data is enough, no new field.
 *   6. plain acknowledge — the default. Deliberately does NOT consult
 *      graph.relations/unresolved/other elements to pick a probe
 *      target; it always speaks to the newest evidence.
 *      Turn 2-3 Parroting Removal Gate — except turn 1 (the very first
 *      evidence of the conversation), which has no continuity to draw
 *      on either and would otherwise be a pure echo; that one case
 *      also falls through to mode:"ask" (fires at most once per
 *      conversation, so this is not "every turn becomes a question").
 *
 * mode:"ask" is now reachable (branches 3/4, and the two Turn 2-3
 * Parroting Removal Gate cases nested in 5/6 above) — still never via
 * `questionFallback`/decideQuestion(); phrased directly by
 * responsePhraser.ts's own ASK mode rule, grounded only in evidenceRefs
 * set here (never the graph.relations/unresolved machinery decideQuestion
 * used, which stays exactly as unused as the NEXT GATE report left it).
 */
function decideResponse(args: {
  newEvidence: EvidenceItem;
  wasCorrection: boolean;
  turn: number;
  providerStatus: ProviderStatus;
  acceptedUpdatesThisTurn: ProposedUpdate[];
  crossElementContinuity?: CrossElementContinuity;
  graph: ContextGraph;
  locale: Locale;
}): ResponseDecision {
  const { newEvidence, wasCorrection, turn, providerStatus, acceptedUpdatesThisTurn, crossElementContinuity, graph, locale } = args;

  // Conversation Quality Gate 2 — checked before EVEN uncertainty/
  // correction: a plainly cut-off message is a different category from
  // "the user is unsure" (still-typing vs. stated-but-unsure), and must
  // never be treated as confirmed content to react to, correct against,
  // or fold into the ContextGraph (see updateGraph()'s matching guard
  // below, which this decision's directText assumes already ran).
  if (hasIncompleteInputSignature(newEvidence.text, locale)) {
    return {
      id: `ir${turn}`, turn, mode: "acknowledge",
      evidenceRefs: [newEvidence.text],
      reason: `evidence looks like still-being-typed/cut-off input (trailing standalone Hangul jamo in "${newEvidence.text}") — do not force an interpretation or confirm it as Evidence, just invite continuation`,
      providerStatus,
      directText: INCOMPLETE_INPUT_RESPONSE_KO,
    };
  }

  // Gate 1 Runtime Mismatch fix — CASE 1/CASE 2 moved here, ABOVE the
  // pre-existing uncertain/correction checks below. Root cause: the
  // most natural real phrasing of "I don't know what to write" is
  // "...할지 모르겠다", which contains questionCorePrototype.ts's own
  // UNCERTAIN_MARKERS hit ("모르겠다") — with CASE 1 checked (as it was
  // originally) AFTER the `certainty === "uncertain"` branch below,
  // that pre-existing generic branch intercepted it first every time,
  // so CASE 1 never ran in real conversation despite passing every API
  // test built with different (non-"모르겠다") phrasing. Same priority
  // reasoning Conversation Quality Gate 2 already established for
  // itself (a plainly cut-off message is a different, more specific
  // category than generic uncertainty, so it must be checked first) —
  // applied consistently to these two as well: "the user doesn't know
  // WHAT TO WRITE" and "HRI's own response was slow" are both about
  // the tool/input-process, not the stated-but-unsure content
  // `certainty==="uncertain"` exists for, so both must win before it.
  if (hasLatencyFeedback(newEvidence.text, locale)) {
    return {
      id: `ir${turn}`, turn, mode: "acknowledge",
      evidenceRefs: [newEvidence.text],
      reason: `the user is giving Reality Feedback about HRI's own response latency ("${newEvidence.text}"), not describing their own reaction — respond as system feedback about HRI, never as a psychological reflection about the user`,
      providerStatus,
      directText: buildLatencyFeedbackResponseKo(newEvidence.text),
    };
  }

  if (hasInputGuidanceNeed(newEvidence.text, locale)) {
    return {
      id: `ir${turn}`, turn, mode: "acknowledge",
      evidenceRefs: [newEvidence.text],
      reason: `the user is expressing difficulty with WHAT TO WRITE (a meta statement about the input task itself: "${newEvidence.text}"), not life content to ask a follow-up question about — give permission/guidance instead of another question`,
      providerStatus,
      directText: INPUT_GUIDANCE_RESPONSE_KO,
    };
  }

  if (newEvidence.certainty === "uncertain") {
    return {
      id: `ir${turn}`, turn, mode: "acknowledge-uncertainty",
      evidenceRefs: [newEvidence.text],
      reason: "evidence marked uncertain (reused questionCorePrototype.ts marker check) — Response accepts the uncertainty without pressing for more",
      providerStatus,
    };
  }

  if (wasCorrection) {
    return {
      id: `ir${turn}`, turn, mode: "acknowledge-correction",
      evidenceRefs: [newEvidence.text],
      reason: "evidence is a correction (reused questionCorePrototype.ts marker check) — Response accepts it naturally, without re-litigating",
      providerStatus,
    };
  }

  if (hasHedge(newEvidence.text, locale)) {
    return {
      id: `ir${turn}`, turn, mode: "ask",
      evidenceRefs: [newEvidence.text],
      reason: `the user voiced a guess/hedge without stating its basis ("${newEvidence.text}") — ask what led them to think so; never assert whether it's true, never invent a feeling`,
      providerStatus,
    };
  }

  if (newEvidence.act === "confirmation") {
    const target = mostRecentActiveElement(graph);
    if (target) {
      return {
        id: `ir${turn}`, turn, mode: "ask",
        evidenceRefs: [target.description],
        reason: `the user only confirmed ("${newEvidence.text}") with no new content of its own — ask about the next genuinely open part of "${target.id}" instead of echoing the bare confirmation`,
        providerStatus,
      };
    }
    // No active element to follow up on yet (e.g. confirmation as a
    // very first turn) — falls through to plain acknowledge below,
    // same safe default as before this Gate.
  }

  if (acceptedUpdatesThisTurn.length > 0) {
    const u = [...acceptedUpdatesThisTurn].sort((a, b) => b.confidence - a.confidence)[0];
    const target = elementById(graph, u.targetElementId);
    const priorText = target?.evidenceRefs[0]?.sourceText;

    // Turn 2-3 Parroting Removal Gate — evidenceRefs.length already
    // counts how many times THIS element has been merged into (1 at
    // creation, +1 per accepted continuity update — see
    // evaluationHarness.ts's mergeInterpreterOutput, which appends,
    // never replaces). >=3 means this would be the SECOND consecutive
    // continuity turn on the same element (CASE B/C's T3): the first
    // continuity (len=2) still adds a genuine new dimension (e.g. Fact
    // -> Feeling) and is left as acknowledge-continuity below; only the
    // second one onward — re-merging what's already been said twice —
    // is redirected to the existing "ask" mode instead, so the Response
    // moves to the NEXT dimension (Change/Meaning) rather than
    // restating the whole thread again. No new field, no ContextGraph
    // change — reuses data the graph already carries.
    if (target && target.evidenceRefs.length >= 3) {
      return {
        id: `ir${turn}`, turn, mode: "ask",
        evidenceRefs: [u.groundingText],
        priorEvidenceRef: priorText,
        reason: `evidence has already been added to "${target.id}" ${target.evidenceRefs.length - 1} times with no new dimension surfaced — ask for what's next (what changed, what stood out) instead of re-merging the same thread again`,
        providerStatus,
      };
    }

    return {
      id: `ir${turn}`, turn, mode: "acknowledge-continuity",
      evidenceRefs: [u.groundingText],
      priorEvidenceRef: priorText,
      // Reality Selection Gate — the update's own already-validated
      // subtype, as real usable data (not buried in internalNote below).
      // responsePhraser.ts reads this to let the Response name what KIND
      // of update this is (specify/reinforce/revise/conflict), never a
      // new fact/emotion/cause it doesn't already contain.
      updateContext: target ? { targetKind: target.kind, updateKind: u.kind, identityRelation: u.identityRelation, note: u.note } : undefined,
      otherActiveRealityCount: countOtherActiveRealities(graph, target?.id),
      internalNote: `Understanding (internal only, never asserted in Response text): this turn ${u.identityRelation} (${u.kind}) prior evidence "${target?.id}" — provider's own note: "${u.note}"`,
      reason: `this turn's evidence continues/specifies prior evidence "${target?.id}" (${u.identityRelation}) — Response may name the update's own kind, never a new relation`,
      providerStatus,
    };
  }

  // Cross-Element Continuity Signal Gate — the sibling of the
  // acceptedUpdatesThisTurn branch just above, for the case that branch
  // structurally cannot cover: this turn's content was correctly placed
  // as its OWN NEW_ELEMENT (a genuinely different fact, not the same
  // referent as anything existing — see contextFirstSemanticAdapter.ts's
  // PHASE 1 STEP 2), yet still continues from prior evidence in the
  // user's own words (a result, reaction, contrast, or further
  // development). Never touches ContextGraph — crossElementContinuity is
  // turn-local only (see its own doc, context/types.ts). Both
  // priorElementId and newElementLocalRef are re-verified against the
  // real, already-merged graph here rather than trusted as-is: a
  // malformed or since-rejected reference degrades to "no signal"
  // (falls through below) rather than fabricating a connection.
  if (crossElementContinuity) {
    const priorElement = elementById(graph, crossElementContinuity.priorElementId);
    const newElement = elementById(graph, crossElementContinuity.newElementLocalRef);
    if (priorElement && newElement) {
      const priorText = priorElement.evidenceRefs[0]?.sourceText;
      return {
        id: `ir${turn}`, turn, mode: "acknowledge-continuity",
        evidenceRefs: [newEvidence.text],
        priorEvidenceRef: priorText,
        internalNote: `Understanding (internal only, never asserted in Response text): this turn's new element "${newElement.id}" continues from prior element "${priorElement.id}" (cross-element continuity, confidence ${crossElementContinuity.confidence})`,
        reason: `this turn's new element ("${newElement.id}") continues from prior evidence "${priorElement.id}" per the provider's turn-local continuity signal — Response names both without asserting how they relate`,
        providerStatus,
      };
    }
  }

  // Turn 2-3 Parroting Removal Gate — the very first evidence in the
  // whole conversation (turn === 1: reducer.ts starts turnCount at 0
  // and increments before this runs, so this is exactly the opening
  // turn) has nothing to add continuity to and no hedge/confirmation
  // signal either — a plain acknowledge here is definitionally just an
  // echo (Information Gain ~= 0, see CASE A). Redirected to the
  // existing "ask" mode so the opening turn pairs a short
  // understanding with one genuine question, the same shape HRI
  // already uses for hedge/confirmation-only. Every later
  // plain-acknowledge turn (turn > 1) is untouched by this — it fires
  // at most once per conversation, so this does not turn every turn
  // into a question.
  if (turn === 1) {
    return {
      id: `ir${turn}`, turn, mode: "ask",
      evidenceRefs: [newEvidence.text],
      reason: "this is the first thing the user has shared this conversation — a plain acknowledgment would just echo it back with no new content, so pair a short understanding with one genuine opening question instead",
      providerStatus,
    };
  }

  // Reality Selection Gate — Negative Control protected: this branch
  // still never names, quotes, or references any other element (no
  // relation, no Link, unchanged from before this Gate). It only
  // attaches how many OTHER active Reality Points already exist this
  // session as observation metadata — responsePhraser.ts does not read
  // this field this Gate, so wording here is byte-identical to before.
  return {
    id: `ir${turn}`, turn, mode: "acknowledge",
    evidenceRefs: [newEvidence.text],
    otherActiveRealityCount: countOtherActiveRealities(graph, mostRecentActiveElement(graph)?.id),
    reason: "plain acknowledgment of the latest evidence — no correction/uncertainty/continuity signal this turn",
    providerStatus,
  };
}

/**
 * Deterministic fallback wording for Response — same grammar-safety
 * pattern as renderProbeTemplate ("라고" attaches to a full "-다"
 * sentence-final quote, invariant regardless of batchim). Always
 * available when responsePhraser.ts is unavailable or its output fails
 * validation.
 */
function renderResponseTemplate(decision: ResponseDecision, locale: Locale): string {
  const first = decision.evidenceRefs[0] ?? "";
  // Multilingual Gate — English. Deliberately plain/template-like, same
  // "always-available safety net, not the live voice" philosophy as
  // the ko/ja branches — avoids the specific echo phrases Beta Handoff
  // §7 bans for the LIVE prompt voice ("So you're saying...", "It
  // sounds like...", etc.), since this fallback is the degraded path,
  // not AURINA's real voice.
  if (locale === "en") {
    // `first`/`priorEvidenceRef` are raw user text and often already
    // end in their own punctuation — found via real conversation (E2):
    // a trailing template period after the closing quote produced
    // '..."​.' (double punctuation). No trailing period after a quoted
    // value avoids this regardless of what the quoted text ends with.
    const quote = (s: string) => `"${s.replace(/[.!?]+$/, "")}"`;
    switch (decision.mode) {
      case "acknowledge-uncertainty":
        return `You mentioned ${quote(first)} — it's fine to leave it there for now.`;
      case "acknowledge-correction":
        return `You corrected that to ${quote(first)} — noted.`;
      case "acknowledge-continuity":
        return decision.priorEvidenceRef
          ? `Following ${quote(decision.priorEvidenceRef)}, you added ${quote(first)}.`
          : `You mentioned ${quote(first)}.`;
      case "ask":
        return decision.questionFallback ? renderProbeTemplate(decision.questionFallback) : `Is there anything more that comes to mind about ${quote(first)}?`;
      case "acknowledge":
      default:
        return `You mentioned ${quote(first)}.`;
    }
  }
  if (locale === "ja") {
    switch (decision.mode) {
      case "acknowledge-uncertainty":
        return `「${first}」とおっしゃいましたね。今はそのままにしておいて大丈夫です。`;
      case "acknowledge-correction":
        return `「${first}」と直していただきましたね。そのように受け止めます。`;
      case "acknowledge-continuity":
        return decision.priorEvidenceRef
          ? `「${decision.priorEvidenceRef}」に続けて「${first}」とおっしゃいましたね。`
          : `「${first}」とおっしゃいましたね。`;
      case "ask":
        return decision.questionFallback ? renderProbeTemplate(decision.questionFallback) : `「${first}」について、もう少し思い浮かぶことはありますか？`;
      case "acknowledge":
      default:
        return `「${first}」とおっしゃいましたね。`;
    }
  }
  switch (decision.mode) {
    case "acknowledge-uncertainty":
      return `'${first}'라고 말씀해 주셨어요. 지금은 그 정도로 남겨두셔도 괜찮습니다.`;
    case "acknowledge-correction":
      return `'${first}'라고 정정해 주셨네요. 그렇게 받아들이겠습니다.`;
    case "acknowledge-continuity":
      return decision.priorEvidenceRef
        ? `'${decision.priorEvidenceRef}'에 이어 '${first}'라고 말씀해 주셨네요.`
        : `'${first}'라고 말씀해 주셨네요.`;
    case "ask":
      return decision.questionFallback ? renderProbeTemplate(decision.questionFallback) : `'${first}'에서, 조금 더 떠오르는 것이 있다면 무엇인가요?`;
    case "acknowledge":
    default:
      return `'${first}'라고 말씀해 주셨네요.`;
  }
}

function isProviderUnavailableOutput(output: InterpreterOutput): boolean {
  return (
    output.newElements.length === 0 &&
    output.updatedElements.length === 0 &&
    output.relations.length === 0 &&
    output.unresolvedCandidates.length === 0 &&
    output.confidence === 0 &&
    output.uncertaintyNotes.some(
      (n) => n.includes("OPENAI_API_KEY not set") || n.includes("HTTP") || n.includes("provider"),
    )
  );
}

export type UpdateGraphInput = Omit<AdvanceIntelligenceInput, "priorProbedRefs">;

export type UpdateGraphResult = {
  graph: ContextGraph;
  proposalFeedback: PreviousProposalFeedback;
  acceptedUpdatesThisTurn: ProposedUpdate[];
  providerStatus: ProviderStatus;
  /** Cross-Element Continuity Signal Gate — turn-local only, read
   *  directly off the interpreter's raw/combined output (bypassing
   *  filterAcceptedProposals/mergeInterpreterOutput, neither of which
   *  carries it — see contextFirstSemanticAdapter.ts's own doc on this
   *  field). Never stored on `graph`. */
  crossElementContinuity?: CrossElementContinuity;
};

/**
 * Gate 29 §9 — split out of advanceIntelligence so the Learning step
 * (interpret -> correction bridge -> validate -> merge) can run on ITS
 * OWN, without also deciding/phrasing a question. Root cause this
 * fixes: Gate 29's own audit found that on a turn where
 * readyToReflect fires (controller.ts calls composeNaturalReflection
 * instead of asking a question), advanceIntelligence was never called
 * at all for that turn's evidence — CASE A/B's turn 4 never entered
 * the ContextGraph, so if a future Gate connects Reflection to this
 * same graph, the most recent turn would silently be missing from it.
 * controller.ts now calls this function on the reflect branch too
 * (question decision/wording are skipped there — no question is
 * rendered on a reflect turn regardless of Core). Nothing about
 * Reflection's own text changes this Gate — only that intelligenceGraph
 * itself now stays complete.
 */
export async function updateGraph(input: UpdateGraphInput): Promise<UpdateGraphResult> {
  const { priorGraph, newEvidence, wasCorrection, supersededEvidenceText, turn, interpreter, allTurns, locale } = input;

  // Conversation Quality Gate 2 — a plainly cut-off/still-typing turn
  // (see hasIncompleteInputSignature's own doc) is never sent to the
  // semantic interpreter at all: the graph is the one thing that
  // eventually surfaces in Reflection, so "not confirmed as Evidence"
  // has to mean the graph itself never absorbs it, not just that this
  // turn's Response avoids mentioning it. priorGraph is returned
  // completely unchanged — no new/updated element, no interpreter
  // call, no latency spent on a call whose output would only ever be
  // discarded. KO only (see that function's own locale guard).
  if (hasIncompleteInputSignature(newEvidence.text, locale)) {
    devLog("INTELLIGENCE GRAPH UPDATE:", {
      turn, providerStatus: "success", skipped: "incomplete input signature — not sent to interpreter, graph unchanged",
      elementCount: priorGraph.elements.length, relationCount: priorGraph.relations.length, unresolvedCount: priorGraph.unresolved.length,
    });
    return {
      graph: priorGraph,
      proposalFeedback: { acceptedRefs: [], rejectedRefs: [], uncertainRefs: [], reasons: ["skipped: incomplete/still-typing input, not sent to interpreter"] },
      acceptedUpdatesThisTurn: [],
      providerStatus: "success",
    };
  }

  const recentTurns = allTurns.slice(-RECENT_TURNS_WINDOW);

  let rawOutput: InterpreterOutput;
  let providerStatus: ProviderStatus;
  try {
    rawOutput = await interpreter.interpret({
      recentTurns,
      activeContext: summarizeGraph(priorGraph),
      mode: "individual",
      previousProposal: input.priorProposalFeedback,
    });
    providerStatus = isProviderUnavailableOutput(rawOutput) ? "unavailable" : "success";
  } catch (err) {
    rawOutput = { newElements: [], updatedElements: [], relations: [], unresolvedCandidates: [], confidence: 0, uncertaintyNotes: [`interpreter threw: ${String(err)}`] };
    providerStatus = "error";
  }

  // Correction ownership (Gate 27 §13): fallback fires only for
  // elements the provider's own updates this turn did NOT cover.
  const providerCoveredTargets = new Set(rawOutput.updatedElements.map((u) => u.targetElementId));
  const correctionUpdates =
    wasCorrection && supersededEvidenceText
      ? buildCorrectionUpdates(priorGraph, supersededEvidenceText, newEvidence, turn, providerCoveredTargets)
      : [];

  const combinedOutput: InterpreterOutput = {
    ...rawOutput,
    updatedElements: [...rawOutput.updatedElements, ...correctionUpdates],
  };

  const validation = validateInterpretation(combinedOutput, priorGraph, recentTurns, turn);

  let graph = priorGraph;
  let acceptedUpdatesThisTurn: ProposedUpdate[] = [];
  let crossElementContinuity: CrossElementContinuity | undefined;
  if (validation.summary.status !== "REJECT") {
    const accepted = filterAcceptedProposals(combinedOutput, validation);
    acceptedUpdatesThisTurn = accepted.updatedElements;
    graph = mergeInterpreterOutput(priorGraph, accepted, turn);
    // filterAcceptedProposals/mergeInterpreterOutput do not carry this
    // field through (it is never a "proposal" subject to V1-V10
    // grounding review, nor ever merged into the graph) — read directly
    // off combinedOutput instead, same turn-local scope as
    // acceptedUpdatesThisTurn above.
    crossElementContinuity = combinedOutput.crossElementContinuity;
  }

  const proposalFeedback = buildProposalFeedback(validation);

  devLog("INTELLIGENCE GRAPH UPDATE:", {
    turn, providerStatus,
    elementCount: graph.elements.length, relationCount: graph.relations.length, unresolvedCount: graph.unresolved.length,
  });

  // Shadow Validation Prototype — observation only. crossElementContinuity
  // returned below is still the RAW, unvalidated signal (unchanged from
  // before this Gate) — decideResponse() keeps consuming exactly that,
  // exactly as it did before. This log is the only place the validated
  // ("shadow") result is visible.
  const shadowLink = shadowValidateCrossElementContinuity(crossElementContinuity, graph, recentTurns, turn);
  devLog("SHADOW LINK VALIDATION:", {
    turn,
    rawContinuity: crossElementContinuity ?? "none",
    shadowValidatedContinuity: shadowLink.result === "accepted" ? crossElementContinuity : "none",
    shadowResult: shadowLink.result,
    shadowReason: shadowLink.reason,
  });

  // Structured Reality Update — acceptedUpdatesThisTurn already carries
  // kind (reinforce/specify/revise/conflict/deprioritize/resolve) and
  // identityRelation (continuation/clarification/revision/
  // uncertainSameElement); observed directly here rather than reshaped
  // through a separate Movement layer (retired this Gate — that layer
  // only renamed this same data, see git history for realityMovement.ts).
  // devLog only — never affects `graph`, never affects this function's
  // return value.
  devLog("STRUCTURED REALITY UPDATE:", { turn, updates: acceptedUpdatesThisTurn });

  // User-Stated Line Deterministic Capture Gate — fallback only; a
  // no-op whenever the LLM's own PHASE 3 already captured the
  // connection, whenever no crossElementContinuity signal exists, or
  // whenever the shadow validator rejected it. See the function's own
  // doc above for exactly what it does and does not do.
  const fallbackRelation = buildDeterministicUserStatedRelation(graph, crossElementContinuity, shadowLink, turn);
  if (fallbackRelation) {
    graph = {
      ...graph,
      relations: [...graph.relations, fallbackRelation],
      updateLog: [
        ...graph.updateLog,
        { turn, elementId: `${fallbackRelation.from}~${fallbackRelation.to}`, kind: "create", note: `deterministic user-stated relation (${fallbackRelation.type})` },
      ],
    };
    devLog("USER-STATED RELATION (deterministic fallback):", { turn, relation: fallbackRelation });
  }

  return { graph, proposalFeedback, acceptedUpdatesThisTurn, providerStatus, crossElementContinuity };
}

export async function advanceIntelligence(
  input: AdvanceIntelligenceInput,
  phraseStats?: ResponseCallStat[],
): Promise<AdvanceIntelligenceResult> {
  const { graph, proposalFeedback, acceptedUpdatesThisTurn, providerStatus, crossElementContinuity } = await updateGraph(input);

  const decision = decideResponse({
    graph, newEvidence: input.newEvidence, wasCorrection: input.wasCorrection,
    turn: input.turn, providerStatus, acceptedUpdatesThisTurn, crossElementContinuity, locale: input.locale,
  });

  // Response wording layer, separate from the decision layer above.
  // Always attempted; always falls back safely. mode "ask" (never
  // constructed by decideResponse this Gate, see its own doc) would
  // route through questionPhraser.ts instead — kept for completeness,
  // unreachable in practice.
  //
  // First Conversation Survival Gate 1 — decision.directText (set only
  // for the two narrow KO-only meta cases, see its own doc in types.ts)
  // bypasses the LLM call entirely: the exact wording is fixed and
  // must not risk drifting into a question, and skipping the call also
  // removes one full round-trip's latency for these specific turns.
  let renderedText: string;
  let wordingSource: "provider" | "template";
  let phraseOutcome: string | undefined;
  let phraseError: string | undefined;
  if (decision.directText) {
    renderedText = decision.directText;
    wordingSource = "template";
  } else {
    const phrased = decision.mode === "ask" && decision.questionFallback
      ? await phraseQuestion(decision.questionFallback)
      : await phraseResponse(decision, input.locale, phraseStats);
    renderedText = phrased.text ?? renderResponseTemplate(decision, input.locale);
    wordingSource = phrased.text ? "provider" : "template";
    phraseOutcome = phrased.outcome;
    phraseError = phrased.errorMessage;
  }

  // NEXT GATE — decideResponse() no longer targets a specific
  // ContextElement/UnresolvedPoint id the way decideQuestion did (it
  // always speaks to the newest evidence), so there is no per-turn
  // "probed" id to add. probedRefs is carried forward unchanged —
  // kept in the state shape (and in decideQuestion's fallback path,
  // still fully functional) rather than removed, per the "protect
  // rollback structure" instruction.
  const probedRefs = input.priorProbedRefs;
  const hypotheses = hypothesesFromGraph(graph);

  devLog("INTELLIGENCE CORE:", {
    turn: input.turn, providerStatus, decision, wordingSource,
    phraseOutcome, phraseError,
    elementCount: graph.elements.length, relationCount: graph.relations.length, unresolvedCount: graph.unresolved.length,
  });

  return { graph, probedRefs, proposalFeedback, decision, renderedText, wordingSource, hypotheses };
}
