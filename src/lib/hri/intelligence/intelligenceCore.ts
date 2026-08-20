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
  type ConversationTurn,
  type InterpreterOutput,
  type PreviousProposalFeedback,
  type ProposedUpdate,
  type SemanticContextInterpreter,
  summarizeGraph,
} from "../context/types";
import { validateInterpretation, type InterpretationValidationResult } from "../context/validator";
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
        reason: `relation "${r.id}" (${from.kind} ${r.type} ${to.kind}, confidence=${r.confidence}) not yet probed — ContextRelation.provenance is always "inferred" by construction, so this is always Hypothesis-stance`,
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
/**
 * Exact-match-only after trailing punctuation is stripped (see
 * isConfirmationOnly below) — this is what keeps detection conservative:
 * a marker only fires when the user's ENTIRE turn is bare agreement, not
 * when it appears inside a longer sentence. This matters especially for
 * Japanese per the Handoff's explicit warning (§6): "そうですね" is not
 * always equivalent to Korean "그렇다" — the exact-match gate (unchanged
 * from before this Gate) is exactly what prevents "そうですね、〜" turns
 * with real new content from being misread as bare confirmation.
 */
const CONFIRMATION_ONLY_MARKERS: Record<Locale, string[]> = {
  ko: ["그렇다", "그렇습니다", "맞다", "맞습니다", "그래", "그래요", "그런 것 같다", "그런 것 같아요", "응", "네", "맞아", "맞아요", "그렇지", "그러네", "그러네요"],
  ja: ["そうです", "そうですね", "その通りです", "その通りだね", "はい", "うん", "そうだね", "そうだよ", "そう", "そうそう", "そうか", "そうかも", "そうかもしれません", "確かに", "本当にそうですね"],
  // English candidates named in the Beta Handoff (§6), stored lowercase
  // for case-insensitive matching (see isConfirmationOnly below).
  // Compound forms ("yes, that's right") added after real evidence
  // (E4): the Handoff's own literal test phrase "Yes, that's right."
  // didn't match because "yes" and "that's right" were only stored as
  // separate entries — exact-match-whole-turn (below) requires the
  // combined phrase itself, the way a person actually types it.
  en: [
    "yes", "that's right", "right", "exactly", "i think so", "that's what i mean",
    "yeah", "yep", "correct", "that's it", "yup", "sure", "definitely", "absolutely", "that's correct",
    "yes, that's right", "yeah, that's right", "yes, exactly", "that's exactly right", "yes, that's it",
  ],
};

/** English is matched case-insensitively — Latin script varies case
 *  naturally in a way Korean/Japanese do not; ko/ja stay exactly as
 *  before this Gate (raw, case-sensitive substring match). */
function hasHedge(text: string, locale: Locale): boolean {
  const cmp = locale === "en" ? text.toLowerCase() : text;
  return HEDGE_MARKERS[locale].some((m) => cmp.includes(m));
}

function isConfirmationOnly(text: string, locale: Locale): boolean {
  const trimmed = text.trim().replace(/[.!?~…\s。、]+$/g, "");
  const cmp = locale === "en" ? trimmed.toLowerCase() : trimmed;
  return CONFIRMATION_ONLY_MARKERS[locale].includes(cmp);
}

/** Most recently touched active element — same "fresh first" ordering
 *  decideQuestion()'s probe-connection branch already established
 *  (evidenceRefs[last].turn, ties broken by confidence), reproduced
 *  locally rather than importing that function, so this Gate's change
 *  stays inside decideResponse's own four-branch structure instead of
 *  reopening decideQuestion()'s seven-branch one. */
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
 *   6. plain acknowledge — the default. Deliberately does NOT consult
 *      graph.relations/unresolved/other elements to pick a probe
 *      target; it always speaks to the newest evidence.
 *
 * mode:"ask" is now reachable (branches 3/4 above) — still never via
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
  graph: ContextGraph;
  locale: Locale;
}): ResponseDecision {
  const { newEvidence, wasCorrection, turn, providerStatus, acceptedUpdatesThisTurn, graph, locale } = args;

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

  if (isConfirmationOnly(newEvidence.text, locale)) {
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
    return {
      id: `ir${turn}`, turn, mode: "acknowledge-continuity",
      evidenceRefs: [u.groundingText],
      priorEvidenceRef: priorText,
      internalNote: `Understanding (internal only, never asserted in Response text): this turn ${u.identityRelation} (${u.kind}) prior evidence "${target?.id}" — provider's own note: "${u.note}"`,
      reason: `this turn's evidence continues/specifies prior evidence "${target?.id}" (${u.identityRelation}) — Response names both without asserting how they relate`,
      providerStatus,
    };
  }

  return {
    id: `ir${turn}`, turn, mode: "acknowledge",
    evidenceRefs: [newEvidence.text],
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
  const { priorGraph, newEvidence, wasCorrection, supersededEvidenceText, turn, interpreter, allTurns } = input;

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
  if (validation.summary.status !== "REJECT") {
    const accepted = filterAcceptedProposals(combinedOutput, validation);
    acceptedUpdatesThisTurn = accepted.updatedElements;
    graph = mergeInterpreterOutput(priorGraph, accepted, turn);
  }

  const proposalFeedback = buildProposalFeedback(validation);

  devLog("INTELLIGENCE GRAPH UPDATE:", {
    turn, providerStatus,
    elementCount: graph.elements.length, relationCount: graph.relations.length, unresolvedCount: graph.unresolved.length,
  });

  return { graph, proposalFeedback, acceptedUpdatesThisTurn, providerStatus };
}

export async function advanceIntelligence(
  input: AdvanceIntelligenceInput,
  phraseStats?: ResponseCallStat[],
): Promise<AdvanceIntelligenceResult> {
  const { graph, proposalFeedback, acceptedUpdatesThisTurn, providerStatus } = await updateGraph(input);

  const decision = decideResponse({
    graph, newEvidence: input.newEvidence, wasCorrection: input.wasCorrection,
    turn: input.turn, providerStatus, acceptedUpdatesThisTurn, locale: input.locale,
  });

  // Response wording layer, separate from the decision layer above.
  // Always attempted; always falls back safely. mode "ask" (never
  // constructed by decideResponse this Gate, see its own doc) would
  // route through questionPhraser.ts instead — kept for completeness,
  // unreachable in practice.
  const phrased = decision.mode === "ask" && decision.questionFallback
    ? await phraseQuestion(decision.questionFallback)
    : await phraseResponse(decision, input.locale, phraseStats);
  const renderedText = phrased.text ?? renderResponseTemplate(decision, input.locale);
  const wordingSource: "provider" | "template" = phrased.text ? "provider" : "template";

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
    phraseOutcome: phrased.outcome, phraseError: phrased.errorMessage,
    elementCount: graph.elements.length, relationCount: graph.relations.length, unresolvedCount: graph.unresolved.length,
  });

  return { graph, probedRefs, proposalFeedback, decision, renderedText, wordingSource, hypotheses };
}
