/**
 * Reflection Hint — Step 5 Runtime Integration.
 *
 * A small runtime object answering "what should Reflection emphasize?" —
 * distinct from ObservationSnapshot ("what has been observed?") and
 * never duplicating it: only the four fields Reflection actually needs
 * are exposed here, not the full snapshot (no transitionId,
 * desiredStrategy, contextConfidence, or reason).
 *
 * buildReflectionHint() is pure and deterministic: same inputs always
 * produce the same ReflectionHint, no side effects, no fabrication —
 * a goal is only ever copied from a real, non-fallback snapshot that
 * actually carried one, never invented.
 */

import type { ObservationContext } from "./observationContext";
import type { ObservationNode } from "./observationPaths";
import type { ObservationGoal } from "./observationGoals";
import type { ObservationSnapshot } from "./observationSnapshot";

export type ReflectionHint = {
  context: ObservationContext;
  currentNode: ObservationNode | null;
  goal: ObservationGoal | null;
  fallback: boolean;
  /** turnCount of whichever snapshot (current or previous) this hint was actually sourced from. */
  sourceTurnCount: number;
};

function noopHint(currentSnapshot: ObservationSnapshot | undefined): ReflectionHint {
  return {
    context: "uncertain",
    currentNode: null,
    goal: null,
    fallback: true,
    sourceTurnCount: currentSnapshot?.turnCount ?? 0,
  };
}

/**
 * Selection policy (conservative — never fabricates a Goal/Node/Context):
 *
 * a. currentSnapshot is used when it exists, fallback === false, and
 *    goal !== null — the common case where this turn's own plan is
 *    meaningful.
 *
 * b. Otherwise previousSnapshot is used only when ALL of: it exists,
 *    its fallback === false, its goal !== null, its context matches
 *    currentSnapshot's context, and its turnCount is exactly
 *    currentSnapshot.turnCount - 1 (immediately adjacent — never an
 *    arbitrarily stale snapshot). This covers the common full-coverage
 *    Reflection turn, where the current snapshot's plannerDecision is
 *    null (fallback:true, goal:null) but the immediately preceding
 *    turn had a real plan for the same context.
 *
 * c. Otherwise a no-op hint (fallback:true, goal:null, currentNode:null,
 *    context:"uncertain") — callers must treat this as "behave exactly
 *    as if no hint existed."
 */
export function buildReflectionHint(
  currentSnapshot: ObservationSnapshot | undefined,
  previousSnapshot: ObservationSnapshot | undefined,
): ReflectionHint {
  if (currentSnapshot && currentSnapshot.fallback === false && currentSnapshot.goal !== null) {
    return {
      context: currentSnapshot.context,
      currentNode: currentSnapshot.currentNode,
      goal: currentSnapshot.goal,
      fallback: false,
      sourceTurnCount: currentSnapshot.turnCount,
    };
  }

  if (
    currentSnapshot &&
    previousSnapshot &&
    previousSnapshot.fallback === false &&
    previousSnapshot.goal !== null &&
    previousSnapshot.context === currentSnapshot.context &&
    previousSnapshot.turnCount === currentSnapshot.turnCount - 1
  ) {
    return {
      context: previousSnapshot.context,
      currentNode: previousSnapshot.currentNode,
      goal: previousSnapshot.goal,
      fallback: false,
      sourceTurnCount: previousSnapshot.turnCount,
    };
  }

  return noopHint(currentSnapshot);
}
