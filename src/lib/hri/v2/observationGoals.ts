/**
 * Observation Goals Layer — architecture only.
 *
 * Standalone, dependency-free module, same discipline as the other
 * observation-layer files: no imports from the engine (controller /
 * understandingEngine / questionPlanner / selector / reflectionEngine),
 * not imported by them, not wired in anywhere. Pure data and pure
 * functions only: no question text, no reflection text, no AI logic,
 * no side effects.
 *
 * Canonical transition model: Goals attach to the real
 * ObservationTransition defined in observationTransitions.ts, by
 * transition id — never a locally redefined transition shape, and
 * never a Stage. observationStage.ts is intentionally not imported
 * here (see isGoalComplete below).
 */

import type { ObservationNode } from "./observationPaths";
import type { ObservationTransition, ObservationTransitionId } from "./observationTransitions";
import { getTransitionById } from "./observationTransitions";

export type ObservationGoal =
  | "identify"
  | "stabilize"
  | "expand"
  | "connect"
  | "interpret"
  | "prioritize"
  | "integrate"
  | "reorient";

export interface GoalRule {
  transitionId: ObservationTransitionId;
  goal: ObservationGoal;
}

// Every rule's transitionId must exist in OBSERVATION_TRANSITIONS
// (observationTransitions.ts). "expand" is intentionally unused —
// reserved vocabulary, not filled in arbitrarily. See the final report
// for the full mapping rationale and the one transition left
// unmapped (project:obstacle-to-risk) as a genuine ambiguity.
export const OBSERVATION_GOALS: readonly GoalRule[] = [
  // Individual: situation → emotion → meaning → direction
  { transitionId: "individual:situation-to-emotion", goal: "identify" },
  { transitionId: "individual:emotion-to-meaning", goal: "interpret" },
  { transitionId: "individual:meaning-to-direction", goal: "reorient" },

  // Organization: situation → change → tension → priority → direction
  { transitionId: "organization:situation-to-change", goal: "identify" },
  { transitionId: "organization:change-to-tension", goal: "stabilize" },
  { transitionId: "organization:tension-to-priority", goal: "prioritize" },
  { transitionId: "organization:priority-to-direction", goal: "integrate" },

  // Relationship: connection → emotion → memory → meaning → direction
  { transitionId: "relationship:connection-to-emotion", goal: "connect" },
  { transitionId: "relationship:emotion-to-memory", goal: "connect" },
  { transitionId: "relationship:memory-to-meaning", goal: "interpret" },
  { transitionId: "relationship:meaning-to-direction", goal: "reorient" },

  // Project: status → obstacle → risk → priority → direction
  { transitionId: "project:status-to-obstacle", goal: "identify" },
  // project:obstacle-to-risk intentionally left unmapped — see AMBIGUITY in final report.
  { transitionId: "project:risk-to-priority", goal: "prioritize" },
  { transitionId: "project:priority-to-direction", goal: "integrate" },
];

/** The goal ruled for `id`, or `null` if no rule covers it. */
export function getGoalForTransitionId(id: ObservationTransitionId): ObservationGoal | null {
  const rule = OBSERVATION_GOALS.find((r) => r.transitionId === id);
  return rule?.goal ?? null;
}

/** The goal ruled for `transition`, keyed by its canonical id. */
export function getGoalForTransition(transition: ObservationTransition): ObservationGoal | null {
  return getGoalForTransitionId(transition.id);
}

/** Whether any goal rule covers `id`. */
export function hasGoalForTransition(id: ObservationTransitionId): boolean {
  return OBSERVATION_GOALS.some((r) => r.transitionId === id);
}

/**
 * Whether `goal` has been reached — i.e. at least one of its rules'
 * transitions has its destination node present in `observedNodes`.
 *
 * Reworked from a StageState/hasVisitedStage check (see final report):
 * the canonical transition model keys goals to ObservationTransition,
 * whose `to` is an ObservationNode (12 values), not an ObservationStage
 * (5 values) — and a single goal can now cover several transitions
 * with different destination nodes (e.g. "identify" spans emotion,
 * change and obstacle). A single Stage can no longer represent "this
 * goal is done", so this takes the same observed-node-set shape
 * isTransitionAllowed already uses in observationTransitions.ts,
 * rather than a StageState.
 */
export function isGoalComplete(
  goal: ObservationGoal,
  observedNodes: readonly ObservationNode[],
): boolean {
  return OBSERVATION_GOALS.some((rule) => {
    if (rule.goal !== goal) return false;
    const transition = getTransitionById(rule.transitionId);
    return transition !== null && observedNodes.includes(transition.to);
  });
}
