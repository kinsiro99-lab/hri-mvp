/**
 * Observation Transitions — canonical architecture.
 *
 * Standalone, dependency-free module, same discipline as the other
 * observation-layer files: no imports from the engine (controller /
 * understandingEngine / questionPlanner / selector / reflectionEngine),
 * not imported by them, not wired in anywhere. The only import is a
 * type-only reference to ObservationNode from observationPaths.ts.
 * observationGoals.ts is not touched here — it still holds its own,
 * different (stage-based) ObservationTransition definition until a
 * later task reconciles the two, as instructed.
 *
 * ObservationTransition is the primary computational unit of the HRI
 * Observation OS: not just a (from, to) pair, but where observation
 * currently is, where it should move, why, and under what condition
 * that movement is architecturally allowed. No question text, no
 * reflection text, no AI logic, no runtime confidence — pure data and
 * pure functions only.
 */

import type { ObservationNode } from "./observationPaths";

export type ObservationTransitionId = string;

export type ObservationPurpose =
  | "focus-shift"
  | "experience-discovery"
  | "tension-discovery"
  | "meaning-formation"
  | "relationship-connection"
  | "memory-integration"
  | "risk-recognition"
  | "priority-formation"
  | "future-orientation";

export type ObservationCondition =
  | "source-observed"
  | "change-observed"
  | "emotion-observed"
  | "tension-observed"
  | "memory-observed"
  | "meaning-observed"
  | "risk-observed"
  | "priority-observed";

export interface ObservationTransition {
  readonly id: ObservationTransitionId;
  readonly from: ObservationNode;
  readonly to: ObservationNode;
  readonly purpose: ObservationPurpose;
  readonly condition: ObservationCondition;
}

/**
 * Every transition explicitly supported by the four context-specific
 * paths in observationPaths.ts (inspected directly before writing
 * this — node names and order copied exactly, not re-derived from
 * memory). No universal linear sequence: each path's own consecutive
 * node pairs, and nothing else.
 *
 * FLAGGED AMBIGUITY (per validation requirement #7): "project:obstacle-
 * to-risk" has no exact match in ObservationCondition — there is no
 * "obstacle-observed" value, and "obstacle" is not a path's first node
 * (so it isn't a natural fit for "source-observed" either, which is
 * used elsewhere for genuine path-start transitions). No new condition
 * value was invented to fill this gap, since ObservationCondition is
 * a closed, explicitly given type. "source-observed" was chosen as the
 * closest conservative fallback; isTransitionAllowed's fallback logic
 * below still evaluates it safely regardless (see that function's
 * documentation). This is the one entry most worth reviewing.
 */
export const OBSERVATION_TRANSITIONS: readonly ObservationTransition[] = [
  // Individual: situation → emotion → meaning → direction
  {
    id: "individual:situation-to-emotion",
    from: "situation",
    to: "emotion",
    purpose: "experience-discovery",
    condition: "source-observed",
  },
  {
    id: "individual:emotion-to-meaning",
    from: "emotion",
    to: "meaning",
    purpose: "meaning-formation",
    condition: "emotion-observed",
  },
  {
    id: "individual:meaning-to-direction",
    from: "meaning",
    to: "direction",
    purpose: "future-orientation",
    condition: "meaning-observed",
  },

  // Organization: situation → change → tension → priority → direction
  {
    id: "organization:situation-to-change",
    from: "situation",
    to: "change",
    purpose: "focus-shift",
    condition: "source-observed",
  },
  {
    id: "organization:change-to-tension",
    from: "change",
    to: "tension",
    purpose: "tension-discovery",
    condition: "change-observed",
  },
  {
    id: "organization:tension-to-priority",
    from: "tension",
    to: "priority",
    purpose: "priority-formation",
    condition: "tension-observed",
  },
  {
    id: "organization:priority-to-direction",
    from: "priority",
    to: "direction",
    purpose: "future-orientation",
    condition: "priority-observed",
  },

  // Relationship: connection → emotion → memory → meaning → direction
  {
    id: "relationship:connection-to-emotion",
    from: "connection",
    to: "emotion",
    purpose: "relationship-connection",
    condition: "source-observed",
  },
  {
    id: "relationship:emotion-to-memory",
    from: "emotion",
    to: "memory",
    purpose: "memory-integration",
    condition: "emotion-observed",
  },
  {
    id: "relationship:memory-to-meaning",
    from: "memory",
    to: "meaning",
    purpose: "meaning-formation",
    condition: "memory-observed",
  },
  {
    id: "relationship:meaning-to-direction",
    from: "meaning",
    to: "direction",
    purpose: "future-orientation",
    condition: "meaning-observed",
  },

  // Project: status → obstacle → risk → priority → direction
  {
    id: "project:status-to-obstacle",
    from: "status",
    to: "obstacle",
    purpose: "focus-shift",
    condition: "source-observed",
  },
  {
    id: "project:obstacle-to-risk",
    from: "obstacle",
    to: "risk",
    purpose: "risk-recognition",
    // See FLAGGED AMBIGUITY note above OBSERVATION_TRANSITIONS.
    condition: "source-observed",
  },
  {
    id: "project:risk-to-priority",
    from: "risk",
    to: "priority",
    purpose: "priority-formation",
    condition: "risk-observed",
  },
  {
    id: "project:priority-to-direction",
    from: "priority",
    to: "direction",
    purpose: "future-orientation",
    condition: "priority-observed",
  },
];

export function getTransitionById(id: ObservationTransitionId): ObservationTransition | null {
  return OBSERVATION_TRANSITIONS.find((t) => t.id === id) ?? null;
}

/**
 * The transition from `from` to `to`, or `null` if none exists.
 *
 * NOTE: two path-specific (from, to) pairs are shared across contexts
 * — "meaning"→"direction" (individual and relationship) and
 * "priority"→"direction" (organization and project). This returns
 * whichever matches first; by construction both share the same
 * purpose and condition in each case, so the returned data is
 * semantically identical regardless of which one is found. Only the
 * `id` would differ — use getTransitionById if the specific path's id
 * matters.
 */
export function getTransition(
  from: ObservationNode,
  to: ObservationNode,
): ObservationTransition | null {
  return OBSERVATION_TRANSITIONS.find((t) => t.from === from && t.to === to) ?? null;
}

export function getTransitionsFrom(node: ObservationNode): readonly ObservationTransition[] {
  return OBSERVATION_TRANSITIONS.filter((t) => t.from === node);
}

// Direct node ↔ condition correspondence for the seven conditions that
// name a real ObservationNode. "source-observed" is deliberately absent
// — see isTransitionAllowed's fallback below.
const CONDITION_NODE: Partial<Record<ObservationCondition, ObservationNode>> = {
  "change-observed": "change",
  "emotion-observed": "emotion",
  "tension-observed": "tension",
  "memory-observed": "memory",
  "meaning-observed": "meaning",
  "risk-observed": "risk",
  "priority-observed": "priority",
};

/**
 * Whether `transition` is allowed given the nodes already observed.
 * Evaluated purely from the transition's architectural `condition` —
 * no confidence scores, no text interpretation.
 *
 * LIMITATION (documented, per validation requirement): "source-observed"
 * cannot be reliably evaluated from node names alone. A path's "source"
 * node differs by context (situation / connection / status), and
 * `observedNodes` carries no context tag to disambiguate which one
 * applies. Conservative fallback: require the transition's own `from`
 * node to be present in `observedNodes` — the minimum precondition any
 * transition needs regardless of context. This also covers the
 * project:obstacle-to-risk ambiguity flagged above.
 */
export function isTransitionAllowed(
  transition: ObservationTransition,
  observedNodes: readonly ObservationNode[],
): boolean {
  const requiredNode = CONDITION_NODE[transition.condition];

  if (requiredNode) {
    return observedNodes.includes(requiredNode);
  }

  return observedNodes.includes(transition.from);
}
