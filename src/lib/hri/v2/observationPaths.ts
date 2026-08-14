/**
 * Observation Paths — architecture only.
 *
 * Standalone, dependency-free module, same discipline as
 * observationContext.ts and observationStage.ts: no imports from the
 * engine (controller / understandingEngine / questionPlanner /
 * selector / reflectionEngine), not imported by them, not wired in
 * anywhere. The only import is a type-only reference to the existing
 * ObservationContext — a compile-time-only dependency between two
 * standalone modules, not an engine connection. Every function here
 * is pure: no question generation, no reflection generation, no AI
 * logic, no side effects.
 */

import type { ObservationContext } from "./observationContext";

/** Every distinct node that appears across the four context paths. */
export type ObservationNode =
  | "situation"
  | "emotion"
  | "meaning"
  | "direction"
  | "change"
  | "tension"
  | "priority"
  | "connection"
  | "memory"
  | "status"
  | "obstacle"
  | "risk";

export interface ObservationPath {
  context: ObservationContext;
  nodes: ObservationNode[];
}

/** Contexts that have a defined path. "uncertain" deliberately has none. */
type PathedContext = Exclude<ObservationContext, "uncertain">;

export const OBSERVATION_PATHS: Readonly<Record<PathedContext, ObservationPath>> = {
  individual: {
    context: "individual",
    nodes: ["situation", "emotion", "meaning", "direction"],
  },
  organization: {
    context: "organization",
    nodes: ["situation", "change", "tension", "priority", "direction"],
  },
  relationship: {
    context: "relationship",
    nodes: ["connection", "emotion", "memory", "meaning", "direction"],
  },
  project: {
    context: "project",
    nodes: ["status", "obstacle", "risk", "priority", "direction"],
  },
};

/**
 * The path for a given context, or `null` for "uncertain" — there is
 * no defined path for it, and none is invented here.
 */
export function getObservationPath(context: ObservationContext): ObservationPath | null {
  if (context === "uncertain") return null;
  return OBSERVATION_PATHS[context];
}

/** The node at `index`, or `null` if out of range. */
export function getCurrentNode(path: ObservationPath, index: number): ObservationNode | null {
  return path.nodes[index] ?? null;
}

/** The node after `index`, or `null` if `index` is already the last node. */
export function getNextNode(path: ObservationPath, index: number): ObservationNode | null {
  return path.nodes[index + 1] ?? null;
}

/** Whether `index` points at the final node in `path`. */
export function isLastNode(path: ObservationPath, index: number): boolean {
  return index === path.nodes.length - 1;
}
