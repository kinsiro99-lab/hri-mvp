/**
 * Question Strategy Layer — architecture only.
 *
 * Standalone, dependency-free module: no imports from the engine
 * (controller / understandingEngine / selector / reflectionEngine),
 * not wired into their runtime logic. The only import is a type-only
 * reference to ObservationNode from the sibling standalone module
 * observationPaths.ts — a compile-time dependency between two
 * unconnected modules, not an engine connection. Pure data and pure
 * functions only: no question text, no AI logic, no side effects.
 *
 * EXCEPTION (First Runtime Integration): questionPlanner.ts now takes
 * a type-only import of QuestionStrategy to label question roles for
 * repetition detection. That is a compile-time-only reference to this
 * module's vocabulary — none of this file's data or functions are
 * called at runtime by the engine.
 */

import type { ObservationNode } from "./observationPaths";

export type QuestionStrategy =
  | "clarify"
  | "explore"
  | "emotion"
  | "tension"
  | "meaning"
  | "direction"
  | "priority"
  | "memory"
  | "connection"
  | "risk"
  | "transition";

export interface StrategyRule {
  node: ObservationNode;
  availableStrategies: readonly QuestionStrategy[];
}

// Each node's strategies are chosen for semantic fit — e.g. "emotion"
// pairs with feeling-oriented nodes, "risk" with obstacle/risk nodes.
// Pure data: no question text, nothing engine-derived.
export const QUESTION_STRATEGIES: readonly StrategyRule[] = [
  { node: "situation", availableStrategies: ["clarify", "explore"] },
  { node: "emotion", availableStrategies: ["emotion", "clarify"] },
  { node: "meaning", availableStrategies: ["meaning", "explore"] },
  { node: "direction", availableStrategies: ["direction", "transition"] },
  { node: "change", availableStrategies: ["explore", "transition"] },
  { node: "tension", availableStrategies: ["clarify", "emotion", "tension"] },
  { node: "priority", availableStrategies: ["priority", "clarify"] },
  { node: "connection", availableStrategies: ["connection", "emotion"] },
  { node: "memory", availableStrategies: ["memory", "explore"] },
  { node: "status", availableStrategies: ["clarify", "explore"] },
  { node: "obstacle", availableStrategies: ["clarify", "risk"] },
  { node: "risk", availableStrategies: ["risk", "priority"] },
];

/** The strategies available for `node`, or an empty array if the node is unrecognized. */
export function getStrategiesForNode(node: ObservationNode): readonly QuestionStrategy[] {
  return QUESTION_STRATEGIES.find((rule) => rule.node === node)?.availableStrategies ?? [];
}

/** Whether `strategy` is one of the strategies available for `node`. */
export function isStrategyAllowed(node: ObservationNode, strategy: QuestionStrategy): boolean {
  return getStrategiesForNode(node).includes(strategy);
}

/**
 * Whether `node` has at least one available strategy not already present
 * in `usedStrategies` — a pure check, takes the used-strategy list as a
 * parameter rather than tracking any state itself.
 */
export function hasUnusedStrategy(
  node: ObservationNode,
  usedStrategies: readonly QuestionStrategy[],
): boolean {
  return getStrategiesForNode(node).some((strategy) => !usedStrategies.includes(strategy));
}
