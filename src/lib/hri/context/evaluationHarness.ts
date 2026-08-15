/**
 * Evaluation Harness — Sprint12-D §17.
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
  InterpreterOutput,
  SemanticContextInterpreter,
  UnresolvedPoint,
} from "./types";
import { emptyContextGraph, summarizeGraph } from "./types";
import { validateInterpretation, type ValidationResult } from "./validator";
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

  // unresolvedCandidates replace the current unresolved set wholesale
  // — this is "what the interpreter currently believes is open", not
  // an ever-growing log (matches contextShadow.ts's own recompute
  // behavior; a future provider may do the same or something else,
  // which is exactly what Sprint12-E's comparison should surface).
  const unresolved: UnresolvedPoint[] = output.unresolvedCandidates.map((u, i) => ({
    id: `unresolved-${turn}-${i}`,
    relatesTo: u.relatesTo,
    reason: u.reason,
    grounding: [{ turn: u.groundingTurn, sourceText: u.groundingText, kind: "inferred" }],
    uncertainty: u.uncertainty,
    potentialInformationGain: u.potentialInformationGain,
  }));

  return { elements, relations, unresolved, updateLog };
}

export type EvaluationResult = {
  caseId: string;
  turnResults: Array<{ turn: number; result: ValidationResult; issueCount: number }>;
  elementCount: number;
  relationCount: number;
  unresolvedCount: number;
  rejectedCount: number;
  rejectionReasons: string[];
  invariantResults: Array<{ name: string; pass: boolean }>;
  allInvariantsPass: boolean;
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
 */
export async function runEvaluation(
  interpreterFactory: () => SemanticContextInterpreter,
  cases: EvaluationCase[],
): Promise<EvaluationResult[]> {
  const results: EvaluationResult[] = [];

  for (const evalCase of cases) {
    const interpreter = interpreterFactory();
    let graph = emptyContextGraph();
    const turnResults: EvaluationResult["turnResults"] = [];
    const rejectionReasons: string[] = [];
    let rejectedCount = 0;
    const allTurns: ConversationTurn[] = evalCase.turns.map((text, i) => ({ turn: i + 1, text }));

    for (let i = 0; i < allTurns.length; i++) {
      const turn = allTurns[i].turn;
      const window = allTurns.slice(Math.max(0, i - RECENT_TURNS_WINDOW + 1), i + 1);

      const output = await interpreter.interpret({
        recentTurns: window,
        activeContext: summarizeGraph(graph),
        mode: "individual",
      });

      const report = validateInterpretation(output, graph, window);
      turnResults.push({ turn, result: report.result, issueCount: report.issues.length });

      if (report.result === "REJECT") {
        rejectedCount++;
        rejectionReasons.push(...report.issues.filter((iss) => iss.severity === "reject").map((iss) => `turn ${turn} [${iss.rule}]: ${iss.message}`));
        continue; // graph unchanged — Sprint12-D §13 fail-safe behavior
      }

      graph = mergeInterpreterOutput(graph, output, turn);
    }

    const invariantResults = evalCase.invariants.map((inv) => ({ name: inv.name, pass: inv.check(graph) }));

    results.push({
      caseId: evalCase.id,
      turnResults,
      elementCount: graph.elements.length,
      relationCount: graph.relations.length,
      unresolvedCount: graph.unresolved.length,
      rejectedCount,
      rejectionReasons,
      invariantResults,
      allInvariantsPass: invariantResults.every((r) => r.pass),
    });
  }

  return results;
}
