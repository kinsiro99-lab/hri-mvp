/**
 * Observation Snapshot — Step 4 Runtime Integration.
 *
 * A runtime state object, not a Reflection rewrite: this module only
 * assembles a flat, pure-data record of what the Observation OS
 * currently believes at the end of a turn. It reads nothing from and
 * writes nothing back into Understanding, Reflection, the UI, or the
 * API. Reflection does not consume this yet — a later step wires that
 * up; this step only produces and persists the object.
 *
 * buildObservationSnapshot() is pure and deterministic: same inputs
 * always produce the same ObservationSnapshot, no side effects, no
 * mutation, no reads of session/runtime state beyond its parameters.
 */

import type { ObservationContext } from "./observationContext";
import type { ObservationNode } from "./observationPaths";
import type { ObservationTransitionId } from "./observationTransitions";
import type { ObservationGoal } from "./observationGoals";
import type { QuestionStrategy } from "./questionStrategies";
import type { ObservationPlan } from "./observationPlanner";

export type ObservationSnapshot = {
  /** The state's turnCount after the current user input has been processed. */
  turnCount: number;
  context: ObservationContext;
  contextConfidence: number;
  currentNode: ObservationNode | null;
  nextNode: ObservationNode | null;
  transitionId: ObservationTransitionId | null;
  /** WHY — from observationGoals.ts, via the transition. */
  goal: ObservationGoal | null;
  /** HOW — the top-ranked strategy for nextNode, goal-informed. */
  desiredStrategy: QuestionStrategy | null;
  fallback: boolean;
  reason: string;
};

export type BuildObservationSnapshotInput = {
  turnCount: number;
  context: ObservationContext;
  contextConfidence: number;
  /**
   * The current turn's ObservationPlan, or null when node/transition/goal
   * planning doesn't apply this turn (context outside individual/organization,
   * confidence too low, no planner decision, safety-abort, or an error while
   * computing it). When null, `fallbackReason` explains why.
   */
  plan: ObservationPlan | null;
  fallbackReason: string;
};

/**
 * Assembles an ObservationSnapshot from already-computed pieces
 * (context detection result + an optional ObservationPlan). Does not
 * call detectObservationContext or planObservation itself — the
 * caller (controller.ts) owns when and whether those run, this module
 * only shapes their results into the persisted record.
 */
export function buildObservationSnapshot({
  turnCount,
  context,
  contextConfidence,
  plan,
  fallbackReason,
}: BuildObservationSnapshotInput): ObservationSnapshot {
  if (!plan) {
    return {
      turnCount,
      context,
      contextConfidence,
      currentNode: null,
      nextNode: null,
      transitionId: null,
      goal: null,
      desiredStrategy: null,
      fallback: true,
      reason: fallbackReason,
    };
  }

  return {
    turnCount,
    context,
    contextConfidence,
    currentNode: plan.currentNode,
    nextNode: plan.nextNode,
    transitionId: plan.transitionId,
    goal: plan.goal,
    desiredStrategy: plan.desiredStrategy,
    fallback: plan.fallback,
    reason: plan.reason,
  };
}
