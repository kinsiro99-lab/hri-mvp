/**
 * Decision Gate — Sprint06 Step 1.
 *
 * Structural move only: Evidence -> Persistent Knowledge -> Gap Map ->
 * Decision Gate -> ASK/REFLECT. This does NOT change what the Engine
 * decides — it moves one existing decision (the legacy
 * `plannerExhaustedWithDepth` boolean that used to live inline in
 * controller.ts) into an explicit function with a named result, so the
 * next Sprint can extend readiness scoring without every caller having
 * to know the raw formula.
 *
 * Gap Map / Knowledge are accepted as inputs (so this function can see
 * them) but are NOT used to change the action this round. Sprint05's
 * Gate rejection found that letting gap presence flip ASK/REFLECT (or
 * flip a null planner decision to non-null) re-surfaced placeholder/
 * sideEffect slots as awkward re-questions and shifted Reflection
 * timing — see questionPlanner.ts's file-level note. This module
 * keeps "a gap exists" and "the Engine is ready to reflect" as two
 * separate, explicitly named facts instead of silently conflating them,
 * without acting on the former yet.
 */
import type { PlannerDecision, Slot } from "./types.v2";
import type { SlotGapState, UnderstandingKnowledge } from "./informationGap";

export type DecisionGateAction = "ask" | "reflect";

export type DecisionGateResult = {
  action: DecisionGateAction;
  reason: string;
};

export type DecisionGateInput = {
  /** This turn's planner output — null once the fixed slot-order walk
   *  is exhausted (see questionPlanner.ts). Not modified by this Gate. */
  plannerDecision: PlannerDecision | null;
  /** Read for visibility only this round — see module doc. */
  gapMap: Record<Slot, SlotGapState>;
  /** Read for visibility only this round — see module doc. */
  knowledge: UnderstandingKnowledge;
  coverageDetailScore: number;
  coverageThreshold: number;
  turnCount: number;
};

/**
 * Same two facts the legacy `plannerExhaustedWithDepth` boolean checked
 * (`plannerDecision === null && coverageDetailScore >= threshold`),
 * now returned as a named action + human-readable reason instead of an
 * anonymous boolean. Callers that previously read
 * `plannerExhaustedWithDepth` should read `result.action === "reflect"`.
 *
 * `canReflect` (turnCount >= MIN turns) is deliberately NOT a factor
 * here, exactly like the legacy boolean it replaces — that gate stays
 * in controller.ts as its own top-level condition (see Sprint06 audit
 * report section B).
 */
export function decideDecisionGate(input: DecisionGateInput): DecisionGateResult {
  const hasQuestionCandidate = input.plannerDecision !== null;
  const readinessMet = input.coverageDetailScore >= input.coverageThreshold;
  const openGapCount = (Object.keys(input.gapMap) as Slot[]).filter(
    (slot) => input.gapMap[slot] !== "sufficient",
  ).length;

  if (!hasQuestionCandidate && readinessMet) {
    return {
      action: "reflect",
      reason:
        `no question candidate (plannerDecision null) and ` +
        `coverageDetailScore ${input.coverageDetailScore} >= threshold ${input.coverageThreshold} ` +
        `(${openGapCount} slot(s) still non-sufficient in Gap Map, not used to change this decision)`,
    };
  }

  return {
    action: "ask",
    reason: hasQuestionCandidate
      ? `question candidate present (slot "${input.plannerDecision!.slot}")`
      : `no question candidate but coverageDetailScore ${input.coverageDetailScore} below threshold ${input.coverageThreshold}`,
  };
}
