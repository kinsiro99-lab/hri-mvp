/**
 * Evaluation Harness — Sprint12-D §17, restructured Sprint12-E3.
 *
 * Provider-independent: runs any SemanticContextInterpreter against
 * the fixed EVALUATION_CASES (§16) through the same merge + Validator
 * pipeline, so RuleBasedAdapter and a future Semantic Provider adapter
 * (Sprint12-E) produce directly comparable results. Structural
 * invariants only — never a golden-text comparison (§18).
 */
import type {
  ContextElement,
  ContextGraph,
  ContextRelation,
  ConversationTurn,
  ElementStatus,
  EvidenceRef,
  InterpreterOutput,
  PreviousProposalFeedback,
  ProposedUnresolved,
  SemanticContextInterpreter,
  UnresolvedPoint,
} from "./types";
import { emptyContextGraph, summarizeGraph } from "./types";
import {
  validateInterpretation,
  type InterpretationStatus,
  type InterpretationValidationResult,
} from "./validator";
import { applyIdentityReview, type SemanticIdentityReviewer } from "./identityReview";
import { CONTEXT_CONFIDENCE_POLICY } from "./confidencePolicy";
import type { EvaluationCase } from "./evaluationCases";

/** Bounded window — never the full conversation (Sprint12-D §5). */
const RECENT_TURNS_WINDOW = 4;

const UPDATE_STATUS: Record<string, ElementStatus | undefined> = {
  reinforce: undefined, // no status change, evidence only
  specify: undefined,
  revise: "revised",
  conflict: "conflicted",
  deprioritize: "deprioritized",
  resolve: "resolved",
};

/**
 * `localRef` is persisted AS the graph element id, not replaced with a
 * harness-generated one. This is deliberate: a later turn's
 * ProposedUpdate.targetElementId can only resolve if the id the
 * interpreter used to create the element earlier is the same id the
 * graph stores it under — an interpreter always sees existing ids via
 * InterpreterInput.activeContext.elements[].id and is expected to
 * reuse them directly (Contract requirement: localRef must be
 * globally unique across a session — RuleBasedAdapter satisfies this
 * via contextShadow.ts's own element ids; a future provider adapter
 * must do the same, e.g. by having the provider echo back existing
 * ids from activeContext instead of minting new ones for updates).
 *
 * Sprint12-E3 §7: this function itself is unchanged from Sprint12-D —
 * it merges whatever InterpreterOutput it is given, with no per-item
 * accept/reject judgment of its own. The judgment now happens upstream
 * in filterAcceptedProposals(), which trims the output down to
 * exactly the proposals that survived proposal-level validation before
 * it ever reaches this function. Keeping merge itself decision-free
 * means there is exactly one place (the Validator) that decides what
 * counts as accepted.
 */
export function mergeInterpreterOutput(graph: ContextGraph, output: InterpreterOutput, turn: number): ContextGraph {
  const elements: ContextElement[] = [...graph.elements];
  const relations: ContextRelation[] = [...graph.relations];
  const updateLog = [...graph.updateLog];
  let relationIdSeq = relations.length + 1;

  const localRefToId = new Map<string, string>();

  for (const el of output.newElements) {
    const id = el.localRef;
    localRefToId.set(el.localRef, id);
    elements.push({
      id,
      kind: el.kind,
      description: el.description,
      active: true,
      status: "active",
      evidenceRefs: [{ turn: el.groundingTurn, sourceText: el.groundingText, kind: el.confidence >= CONTEXT_CONFIDENCE_POLICY.GROUNDED_MIN ? "explicit" : "inferred" }],
      confidence: el.confidence,
    });
    updateLog.push({ turn, elementId: id, kind: "create", note: el.description });
  }

  for (const u of output.updatedElements) {
    const idx = elements.findIndex((e) => e.id === u.targetElementId);
    if (idx === -1) continue;
    const prev = elements[idx];
    const nextStatus = UPDATE_STATUS[u.kind];
    elements[idx] = {
      ...prev,
      status: nextStatus ?? prev.status,
      active: u.kind === "conflict" ? false : prev.active,
      description: `${prev.description} (${u.note})`,
      evidenceRefs: [...prev.evidenceRefs, { turn: u.groundingTurn, sourceText: u.groundingText, kind: "explicit" }],
    };
    updateLog.push({ turn, elementId: prev.id, kind: u.kind, note: u.note });
  }

  const resolveRef = (ref: string): string | undefined => localRefToId.get(ref) ?? (elements.some((e) => e.id === ref) ? ref : undefined);

  for (const r of output.relations) {
    const from = resolveRef(r.from);
    const to = resolveRef(r.to);
    if (!from || !to) continue;
    const duplicate = relations.find((existing) => existing.type === r.type && existing.from === from && existing.to === to);
    if (duplicate) {
      duplicate.evidenceRefs.push({ turn: r.groundingTurn, sourceText: r.groundingText, kind: "inferred" });
      continue;
    }
    relations.push({
      id: `relation-${relationIdSeq++}`,
      type: r.type,
      from,
      to,
      evidenceRefs: [{ turn: r.groundingTurn, sourceText: r.groundingText, kind: "inferred" }],
      provenance: "inferred",
      confidence: r.confidence,
      status: "open",
    });
    updateLog.push({ turn, elementId: `${from}~${to}`, kind: "create", note: `relation ${r.type}` });
  }

  const unresolved = mergeUnresolved(graph.unresolved, output.unresolvedCandidates, turn);

  return { elements, relations, unresolved, updateLog };
}

/**
 * Sprint12-E8 §5/§6 — replaces the Sprint12-D wholesale-replace policy
 * that Sprint12-E7's audit (report §M) found silently destroyed every
 * NOT_DECIDABLE/unresolved point at the very next turn: the Semantic
 * Provider is a stateless, narrow-window call that never saw prior
 * unresolved points at all (Sprint12-E4 through E7 never exposed
 * `unresolved` in ContextGraphSummary), so "wholesale replace with
 * whatever I emit this turn" silently meant "wholesale delete," not
 * "recompute" — that equivalence only held for RuleBasedAdapter, whose
 * `contextShadow.ts` genuinely does recompute its complete, current,
 * authoritative unresolved set from full internal state every call.
 *
 * Policy (Sprint12-E8 §5, no silent deletion §6):
 * - Existing unresolved points are carried forward by default —
 *   absence from this turn's output is NOT evidence of resolution.
 * - `existingUnresolvedId` matching an existing point's id updates that
 *   point in place: `grounding` is APPENDED to (original evidence never
 *   overwritten — §15), while relatesTo/reason/uncertainty/
 *   potentialInformationGain refresh to the latest read, same as how
 *   mergeInterpreterOutput's own updatedElements loop already appends
 *   evidence while updating description.
 * - `existingUnresolvedId` NOT yet present in the graph (first mention)
 *   is created USING that id as its real persisted id — exactly the
 *   same "the id an interpreter echoes back becomes the real graph id"
 *   convention already established for `ProposedElement.localRef` (see
 *   this file's own header comment on mergeInterpreterOutput).
 * - No `existingUnresolvedId` at all: always a fresh point with a
 *   harness-minted id, same as Sprint12-D's original behavior.
 * - No automatic expiry, TTL, or resolution-by-turn-count (§5.5/§5.6) —
 *   an item this function was never told is resolved stays open
 *   indefinitely. Resolution policy is explicitly out of scope this
 *   Sprint (§9) — see Sprint12-E8 report §J/§S for the accumulation
 *   risk this leaves open, observed but not fixed here.
 */
function mergeUnresolved(existing: UnresolvedPoint[], incoming: ProposedUnresolved[], turn: number): UnresolvedPoint[] {
  const result = [...existing];
  let freshSeq = 0;
  for (const u of incoming) {
    const newGrounding: EvidenceRef = { turn: u.groundingTurn, sourceText: u.groundingText, kind: "inferred" };
    if (u.existingUnresolvedId) {
      const idx = result.findIndex((e) => e.id === u.existingUnresolvedId);
      if (idx !== -1) {
        result[idx] = {
          ...result[idx],
          relatesTo: u.relatesTo,
          reason: u.reason,
          grounding: [...result[idx].grounding, newGrounding],
          uncertainty: u.uncertainty,
          potentialInformationGain: u.potentialInformationGain,
        };
        continue;
      }
      result.push({
        id: u.existingUnresolvedId,
        relatesTo: u.relatesTo,
        reason: u.reason,
        grounding: [newGrounding],
        uncertainty: u.uncertainty,
        potentialInformationGain: u.potentialInformationGain,
      });
      continue;
    }
    result.push({
      id: `unresolved-${turn}-${freshSeq++}`,
      relatesTo: u.relatesTo,
      reason: u.reason,
      grounding: [newGrounding],
      uncertainty: u.uncertainty,
      potentialInformationGain: u.potentialInformationGain,
    });
  }
  return result;
}

/**
 * Sprint12-E3 §4/§7: trims a turn's raw InterpreterOutput down to only
 * the proposals that survived proposal-level validation, so
 * mergeInterpreterOutput (unchanged) only ever sees accepted work.
 *
 * Merge policy, decided explicitly here (§7):
 * - REJECT proposals: never merged (unchanged from Sprint12-D).
 * - ACCEPT / ACCEPT_WITH_UNCERTAINTY newElements, relations, and
 *   unresolvedCandidates: merged. Ordinary evidence-quality uncertainty
 *   (e.g. V2/V7 flags) doesn't mean we don't know WHAT this proposal is
 *   about — only how confident to be about it — so it's still safe to
 *   attach to the graph with its own (lower) confidence value intact.
 * - ACCEPT_WITH_UNCERTAINTY updatedElements whose identityRelation is
 *   "uncertainSameElement" are the one deliberate exception: identity
 *   uncertainty means we don't even know WHICH element this update
 *   belongs to, so provisionally attaching it would misrepresent the
 *   graph rather than just under-stating confidence in it. These are
 *   accepted (not punished as REJECT — the Provider was being honest)
 *   but withheld from merge; the Provider learns this happened via
 *   PreviousProposalFeedback.uncertainRefs + reasons on the next turn,
 *   and may re-propose with better grounding or as a new element. See
 *   Sprint12-E3 report §J for the fixture (T6) that pins this down.
 */
export function filterAcceptedProposals(output: InterpreterOutput, validation: InterpretationValidationResult): InterpreterOutput {
  const newElements = validation.newElements
    .filter((p) => p.decision !== "REJECT")
    .map((p) => p.proposal);
  const updatedElements = validation.updatedElements
    .filter((p) => p.decision !== "REJECT" && p.proposal.identityRelation !== "uncertainSameElement")
    .map((p) => p.proposal);
  const relations = validation.relations
    .filter((p) => p.decision !== "REJECT")
    .map((p) => p.proposal);
  const unresolvedCandidates = validation.unresolvedCandidates
    .filter((p) => p.decision !== "REJECT")
    .map((p) => p.proposal);

  return { newElements, updatedElements, relations, unresolvedCandidates, confidence: output.confidence, uncertaintyNotes: output.uncertaintyNotes };
}

/**
 * Sprint12-E3 §12: per-item, not batch-level (Sprint12-E2's
 * approximation — "if anything in the batch was rejected, treat every
 * ref in the batch as rejected" — is gone now that validation itself is
 * per-proposal). A ref appears in exactly one bucket, matching its own
 * proposal's decision.
 */
function buildPreviousProposalFeedback(validation: InterpretationValidationResult): PreviousProposalFeedback {
  const acceptedRefs: string[] = [];
  const rejectedRefs: string[] = [];
  const uncertainRefs: string[] = [];
  const reasons: string[] = [];

  const record = (ref: string, decision: InterpretationValidationResult["newElements"][number]["decision"], issues: InterpretationValidationResult["newElements"][number]["issues"]) => {
    if (decision === "REJECT") rejectedRefs.push(ref);
    else if (decision === "ACCEPT_WITH_UNCERTAINTY") uncertainRefs.push(ref);
    else acceptedRefs.push(ref);
    reasons.push(...issues.map((i) => `[${i.rule}] ${ref}: ${i.message}`));
  };

  for (const n of validation.newElements) record(n.proposal.localRef, n.decision, n.issues);
  for (const u of validation.updatedElements) record(u.proposal.targetElementId, u.decision, u.issues);
  for (const r of validation.relations) record(`${r.proposal.from}->${r.proposal.to}`, r.decision, r.issues);

  return { acceptedRefs, rejectedRefs, uncertainRefs, reasons: reasons.slice(0, 8) };
}

export type EvaluationResult = {
  caseId: string;
  turnResults: Array<{ turn: number; result: InterpretationStatus; issueCount: number }>;
  elementCount: number;
  relationCount: number;
  unresolvedCount: number;
  /** Turns where every proposal was rejected (nothing merged at all). */
  rejectedCount: number;
  /** Sprint12-E3 §6/§28: turns where SOME proposals were accepted and
   *  others rejected in the same batch — the concrete signal that
   *  partial acceptance is doing real work instead of all-or-nothing. */
  partialCount: number;
  rejectionReasons: string[];
  /** Sprint12-E3 §17: true when every element in the final graph has
   *  confidence below GROUNDED_MIN — i.e. any invariant PASS that
   *  depends on "not asserted at grounded-tier confidence" is trivially
   *  true here and carries no real information. Always true for
   *  RuleBasedAdapter (flat 0.6, by design — see ruleBasedAdapter.ts).
   *  Not a code behavior change, purely a reporting diagnostic. */
  neverReachedGroundedTier: boolean;
  invariantResults: Array<{ name: string; kind: "safety" | "presence"; pass: boolean }>;
  /** All safety invariants passed (no bad structure was created). */
  safetyPassed: boolean;
  /** All presence invariants passed (the required minimum structure
   *  actually exists) — false here alongside safetyPassed=true is
   *  exactly the vacuous-PASS signature (Sprint12-E3 §16). */
  presencePassed: boolean;
  vacuousPass: boolean;
  /** = safetyPassed && presencePassed. Same meaning Sprint12-D's
   *  allInvariantsPass always had; name kept for continuity. */
  allInvariantsPass: boolean;
  /** Sprint12-E4 §17, extended Sprint12-E5 §7, restructured Sprint12-E6
   *  §4 to decidability-first: `notDecidable` tallies every proposal the
   *  Reviewer declined to classify at all; the other three only tally
   *  proposals the Reviewer said were DECIDABLE. All zero when no
   *  reviewer is passed (e.g. Rule baseline — §35/§47, never reviewed).
   *  Reported per-case, not just aggregated, so stability across
   *  repeated runs can be inspected directly rather than only inferred
   *  from the final PASS/FAIL. */
  reviewDecisions: { sameElement: number; sameRealityDifferentElement: number; separateReality: number; notDecidable: number };
};

/**
 * Each EvaluationCase is an independent conversation/session, so each
 * gets a freshly-constructed interpreter instance — a stateful
 * adapter (e.g. RuleBasedAdapter, which closes over its own running
 * ShadowContext) must never carry state between unrelated cases, and
 * every case's turns are numbered from 1, so reusing one stateful
 * instance across cases would silently collide turn numbers between
 * unrelated conversations. `interpreterFactory` is called once per
 * case for exactly this reason — this is not specific to the rule
 * adapter; any stateful provider needs the same isolation.
 *
 * Sprint12-E4 §4: `reviewerFactory` is optional and defaults to no
 * review at all — RuleBasedAdapter is never passed one (§27: Rule
 * baseline is a comparison fixture, not this Sprint's development
 * target), so its evaluation path is byte-for-byte the Sprint12-E3
 * path. When supplied, identity review runs on each turn's
 * updatedElements BEFORE the (unmodified) Structural Validator sees
 * them — see identityReview.ts's applyIdentityReview().
 */
export async function runEvaluation(
  interpreterFactory: () => SemanticContextInterpreter,
  cases: EvaluationCase[],
  reviewerFactory?: () => SemanticIdentityReviewer,
): Promise<EvaluationResult[]> {
  const results: EvaluationResult[] = [];

  for (const evalCase of cases) {
    const interpreter = interpreterFactory();
    const reviewer = reviewerFactory?.();
    let graph = emptyContextGraph();
    const turnResults: EvaluationResult["turnResults"] = [];
    const rejectionReasons: string[] = [];
    let rejectedCount = 0;
    let partialCount = 0;
    const reviewDecisions = { sameElement: 0, sameRealityDifferentElement: 0, separateReality: 0, notDecidable: 0 };
    const allTurns: ConversationTurn[] = evalCase.turns.map((text, i) => ({ turn: i + 1, text }));
    let previousProposal: PreviousProposalFeedback | undefined;

    for (let i = 0; i < allTurns.length; i++) {
      const turn = allTurns[i].turn;
      const window = allTurns.slice(Math.max(0, i - RECENT_TURNS_WINDOW + 1), i + 1);

      const rawOutput = await interpreter.interpret({
        recentTurns: window,
        activeContext: summarizeGraph(graph),
        mode: "individual",
        previousProposal,
      });

      let output = rawOutput;
      if (reviewer) {
        const reviewed = await applyIdentityReview(rawOutput, graph, turn, allTurns[i].text, reviewer);
        output = reviewed.output;
        for (const entry of reviewed.log) {
          const key: keyof typeof reviewDecisions =
            entry.decidability === "NOT_DECIDABLE" ? "notDecidable" :
            entry.decision === "SAME_ELEMENT" ? "sameElement" :
            entry.decision === "SAME_REALITY_DIFFERENT_ELEMENT" ? "sameRealityDifferentElement" : "separateReality";
          reviewDecisions[key]++;
        }
      }

      const validation = validateInterpretation(output, graph, window, turn);
      const totalIssues =
        validation.newElements.reduce((n, p) => n + p.issues.length, 0) +
        validation.updatedElements.reduce((n, p) => n + p.issues.length, 0) +
        validation.relations.reduce((n, p) => n + p.issues.length, 0) +
        validation.unresolvedCandidates.reduce((n, p) => n + p.issues.length, 0);
      turnResults.push({ turn, result: validation.summary.status, issueCount: totalIssues });
      previousProposal = buildPreviousProposalFeedback(validation);

      if (validation.summary.status === "REJECT") {
        rejectedCount++;
      } else if (validation.summary.status === "PARTIAL") {
        partialCount++;
      }
      if (validation.summary.rejectedCount > 0) {
        const allProposalValidations = [...validation.newElements, ...validation.updatedElements, ...validation.relations, ...validation.unresolvedCandidates];
        rejectionReasons.push(
          ...allProposalValidations
            .flatMap((p) => p.issues)
            .filter((iss) => iss.severity === "reject")
            .map((iss) => `turn ${turn} [${iss.rule}]: ${iss.message}`),
        );
      }

      if (validation.summary.status === "REJECT") {
        continue; // nothing survived — graph unchanged (Sprint12-D §13 fail-safe behavior)
      }

      const accepted = filterAcceptedProposals(output, validation);
      graph = mergeInterpreterOutput(graph, accepted, turn);
    }

    const invariantResults = evalCase.invariants.map((inv) => ({ name: inv.name, kind: inv.kind, pass: inv.check(graph) }));
    const safetyResults = invariantResults.filter((r) => r.kind === "safety");
    const presenceResults = invariantResults.filter((r) => r.kind === "presence");
    const safetyPassed = safetyResults.every((r) => r.pass);
    const presencePassed = presenceResults.every((r) => r.pass);
    const neverReachedGroundedTier = graph.elements.length > 0 && graph.elements.every((e) => e.confidence < CONTEXT_CONFIDENCE_POLICY.GROUNDED_MIN);
    // Sprint12-E3 §16: "vacuous" specifically means presence failed
    // BECAUSE the graph is empty — safety passing on nothing is
    // trivial. It must NOT fire when real (partial) structure exists
    // but presence fails for a substantive reason (e.g. case
    // 6-multiple-directions genuinely produces 2 elements but is
    // missing the required relation between them) — that is an honest
    // capability gap, not a vacuous PASS, and mislabeling it as
    // "vacuous" would hide a real, measurable limitation.
    const producedNothing = graph.elements.length === 0 && graph.relations.length === 0 && graph.unresolved.length === 0;

    results.push({
      caseId: evalCase.id,
      turnResults,
      elementCount: graph.elements.length,
      relationCount: graph.relations.length,
      unresolvedCount: graph.unresolved.length,
      rejectedCount,
      partialCount,
      rejectionReasons,
      neverReachedGroundedTier,
      invariantResults,
      safetyPassed,
      presencePassed,
      vacuousPass: safetyPassed && presenceResults.length > 0 && !presencePassed && producedNothing,
      allInvariantsPass: safetyPassed && presencePassed,
      reviewDecisions,
    });
  }

  return results;
}
