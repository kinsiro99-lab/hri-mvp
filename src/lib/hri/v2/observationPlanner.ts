/**
 * Observation Planner — Step 2 Runtime Integration.
 *
 * This is the one module in the Observation OS layer that is a real
 * runtime consumer of observationPaths.ts / observationTransitions.ts /
 * questionStrategies.ts: it reads their exported data and functions,
 * but writes nothing back into them, generates no question text, and
 * never touches Understanding. controller.ts is its only caller.
 *
 * It does not re-encode path order, transitions, or node→strategy
 * vocabulary — those come from observationPaths.ts / observationTransitions.ts
 * / questionStrategies.ts directly. The one thing that has no existing
 * home is the Slot↔ObservationNode bridge (Slot is questionPlanner.ts's
 * vocabulary; ObservationNode is the Observation OS's) — that bridge is
 * authored once, here, as SLOT_NODE_BY_CONTEXT, and is the only
 * canonical Slot-to-strategy mapping in the codebase (questionPlanner.ts's
 * Step-1 SLOT_ROLE_BY_CONTEXT / ROLE_ORDER_BY_CONTEXT were removed when
 * this module replaced them).
 *
 * Pure and deterministic: same inputs always produce the same
 * ObservationPlan, no side effects, no mutation.
 */

import type { Slot } from "./types.v2";
import type { UnderstandingCoverage } from "./understandingEngine";
import type { ObservationContext } from "./observationContext";
import type { ObservationNode } from "./observationPaths";
import { getObservationPath, getNextNode } from "./observationPaths";
import type { ObservationTransitionId } from "./observationTransitions";
import { getTransition } from "./observationTransitions";
import type { QuestionStrategy } from "./questionStrategies";
import { getStrategiesForNode } from "./questionStrategies";
import type { ObservationGoal } from "./observationGoals";
import { getGoalForTransitionId } from "./observationGoals";

/** The two contexts this Beta activates for — narrowed at the controller.ts call site. */
export type BetaObservationContext = Extract<ObservationContext, "individual" | "organization">;

export type ObservationPlan = {
  /** The node the last actually-asked slot corresponds to, or null if undetermined. */
  currentNode: ObservationNode | null;
  /** The node one step forward on the path from currentNode, or null if undetermined. */
  nextNode: ObservationNode | null;
  /** The canonical transitionId for currentNode → nextNode, or null if undetermined. */
  transitionId: ObservationTransitionId | null;
  /** The transition's Goal (WHY) from observationGoals.ts, or null if undetermined/unmapped. */
  goal: ObservationGoal | null;
  /**
   * questionStrategies.ts's strategies for nextNode, reordered by
   * GOAL_STRATEGY_POLICY when a goal is known (same set, never added to
   * or filtered down — see that policy's own doc comment for why this
   * is a ranking, not a replacement). May be empty.
   */
  desiredStrategies: readonly QuestionStrategy[];
  /** The top-ranked entry of desiredStrategies (HOW), or null if none. */
  desiredStrategy: QuestionStrategy | null;
  /** An uncovered Slot whose node is nextNode, or null if none exists / none needed. */
  alternateSlot: Slot | null;
  /** Short, human-readable explanation of the decision — for logging only. */
  reason: string;
  /** True whenever currentNode or a valid transition could not be established. */
  fallback: boolean;
};

/**
 * BETA_BRIDGE: SLOT_NODE_BY_CONTEXT
 *
 * Slot (questionPlanner.ts's vocabulary) and ObservationNode
 * (observationPaths.ts's vocabulary) are two independently-designed
 * type systems with no natural correspondence — this hand-authored
 * table is the bridge, not a permanent semantic equivalence. See
 * "Beta Bridges" in docs/ObservationOS.md for why it exists, its known
 * limitations, and its exact removal condition.
 *
 * Kept separate per context because the same slot sits on a different
 * conceptual node depending on which Observation Path it belongs to.
 * The organization path has no "emotion" node — under work-topic
 * answers, both the emotion slot (e.g. "쫓기는 느낌") and presentState
 * slot (e.g. "시간에 쫓기는 상태") are functionally tension, so both
 * map there; that is an intentional consequence, not an oversight — it
 * means asking one right after the other now correctly counts as a
 * same-node repeat. "relationship" has no strong node correspondence
 * on either active path (neither path has a connection node) and
 * defaults conservatively to "situation", the path's own anchor node.
 *
 * Every node on both active paths must have at least one Slot mapped
 * to it, or the alternate-slot search can never advance past that node
 * (caught in testing: an earlier version left organization's "change"
 * node with no slot at all, so a stuck "topic" could never advance).
 * organization's "target" (the specific thing under pressure, e.g.
 * "지금 가장 크게 마음을 차지하는 일은 무엇인가요?") maps to "change"
 * for this reason — it's the concrete shift/pressure driving the path
 * forward, not a restatement of the opening situation.
 */
const SLOT_NODE_BY_CONTEXT: Record<BetaObservationContext, Record<Slot, ObservationNode>> = {
  individual: {
    topic: "situation",
    target: "situation",
    emotion: "emotion",
    relationship: "situation",
    presentState: "situation",
    meaning: "meaning",
    wish: "direction",
  },
  organization: {
    topic: "situation",
    target: "change",
    emotion: "tension",
    relationship: "situation",
    presentState: "tension",
    meaning: "priority",
    wish: "direction",
  },
};

/**
 * BETA_BRIDGE: GOAL_STRATEGY_POLICY
 *
 * ObservationGoal (observationGoals.ts) and QuestionStrategy
 * (questionStrategies.ts) are two independently-designed type systems
 * with no natural correspondence — this hand-authored table is the
 * bridge. See "Beta Bridges" in docs/ObservationOS.md for why it
 * exists, its known limitations, and its exact removal condition.
 *
 * Goal → Strategy POLICY, not a fixed mapping.
 *
 * A Goal expresses WHY the next question moves where it does; a
 * QuestionStrategy expresses HOW it's asked. This table is deliberately
 * a *preference ranking* over each node's own existing strategy set
 * (see how it's used below: it only ever reorders getStrategiesForNode's
 * output, never adds a strategy that isn't already valid for that node,
 * never drops one). It is not treated as an irreversible Goal=Strategy
 * equivalence — a future Observation Intent layer may sit between Goal
 * and Strategy and change how this ranking is produced without any
 * caller-visible contract change, since callers only ever see the
 * already-ranked desiredStrategies / desiredStrategy output.
 *
 * All 8 ObservationGoal values are covered for exhaustiveness; "expand"
 * and "connect" aren't reachable from any individual/organization
 * transition today (see observationGoals.ts's OBSERVATION_GOALS), but
 * are still given a defensible preference for when that changes.
 */
const GOAL_STRATEGY_POLICY: Record<ObservationGoal, readonly QuestionStrategy[]> = {
  identify: ["clarify", "explore"],
  stabilize: ["tension", "clarify"],
  expand: ["explore", "connection"],
  connect: ["connection", "emotion"],
  interpret: ["meaning", "explore"],
  prioritize: ["priority", "tension"],
  integrate: ["direction", "transition"],
  reorient: ["direction", "transition"],
};

/**
 * Reorders `strategies` so that whichever ones `goal` prefers come
 * first (in the policy's own preference order), followed by the rest
 * in their original order. Same set in, same set out — see
 * GOAL_STRATEGY_POLICY's doc comment for why this must stay a ranking
 * rather than a filter or replacement.
 */
function rankStrategiesByGoal(
  strategies: readonly QuestionStrategy[],
  goal: ObservationGoal | null,
): readonly QuestionStrategy[] {
  if (!goal) return strategies;

  const preference = GOAL_STRATEGY_POLICY[goal];
  const preferredPresent = preference.filter((s) => strategies.includes(s));
  const remaining = strategies.filter((s) => !preferredPresent.includes(s));

  return [...preferredPresent, ...remaining];
}

function fallbackPlan(reason: string): ObservationPlan {
  return {
    currentNode: null,
    nextNode: null,
    transitionId: null,
    goal: null,
    desiredStrategies: [],
    desiredStrategy: null,
    alternateSlot: null,
    reason,
    fallback: true,
  };
}

/**
 * Decides whether the Planner's proposed `currentSlot` is repeating a
 * recently-asked Observation node and, if so, finds a safe forward-only
 * alternate Slot for the immediate next node on the path.
 *
 * Derives currentNode conservatively — only from context, coverage,
 * recentSlots, and currentSlot, never from a coverage ratio, turn
 * count, or estimated index. `recentSlots` (the last up to 2 slots a
 * question was actually returned for) is the only signal for "where
 * the conversation currently is"; if it's empty, or if a node/transition
 * can't be resolved from the real path/transition data, this returns
 * fallback:true and the caller must keep the original planner result.
 *
 * Only ever proposes the immediate next node on the path (one
 * transition, not a multi-hop search) — Observation Paths and
 * Transitions are the single source of truth for sequencing here.
 */
export function planObservation(
  context: BetaObservationContext,
  currentSlot: Slot,
  coverage: UnderstandingCoverage,
  recentSlots: readonly Slot[],
): ObservationPlan {
  const slotNode = SLOT_NODE_BY_CONTEXT[context];
  const lastAskedSlot = recentSlots[recentSlots.length - 1];

  if (!lastAskedSlot) {
    return fallbackPlan("no recently asked slot — cannot anchor a current node");
  }

  const currentNode = slotNode[lastAskedSlot];
  const path = getObservationPath(context);

  if (!path) {
    return fallbackPlan(`no observation path defined for "${context}"`);
  }

  const currentIndex = path.nodes.indexOf(currentNode);

  if (currentIndex === -1) {
    return fallbackPlan(`"${currentNode}" is not on the ${context} path`);
  }

  const nextNode = getNextNode(path, currentIndex);

  if (!nextNode) {
    return fallbackPlan(`"${currentNode}" is already the last node on the ${context} path`);
  }

  const transition = getTransition(currentNode, nextNode);

  if (!transition) {
    return fallbackPlan(`no canonical transition from "${currentNode}" to "${nextNode}"`);
  }

  const goal = getGoalForTransitionId(transition.id);
  const desiredStrategies = rankStrategiesByGoal(getStrategiesForNode(nextNode), goal);
  const desiredStrategy = desiredStrategies[0] ?? null;
  const currentSlotNode = slotNode[currentSlot];
  const recentNodes = recentSlots.map((slot) => slotNode[slot]);
  const isRepeat = recentNodes.includes(currentSlotNode);

  if (!isRepeat) {
    return {
      currentNode,
      nextNode,
      transitionId: transition.id,
      goal,
      desiredStrategies,
      desiredStrategy,
      alternateSlot: null,
      reason: `"${currentSlot}" (node "${currentSlotNode}") does not repeat a recent node — baseline stands`,
      fallback: false,
    };
  }

  const alternateSlot =
    (Object.keys(slotNode) as Slot[]).find(
      (slot) => slotNode[slot] === nextNode && !coverage[slot],
    ) ?? null;

  return {
    currentNode,
    nextNode,
    transitionId: transition.id,
    goal,
    desiredStrategies,
    desiredStrategy,
    alternateSlot,
    reason: alternateSlot
      ? `"${currentSlot}" repeats node "${currentSlotNode}" — goal "${goal}" advances via "${transition.id}" to slot "${alternateSlot}" (strategy "${desiredStrategy}")`
      : `"${currentSlot}" repeats node "${currentSlotNode}" but no uncovered slot maps to next node "${nextNode}"`,
    fallback: false,
  };
}
