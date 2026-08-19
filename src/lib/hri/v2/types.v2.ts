import type { UnderstandingState, UnderstandingCoverage } from "./understandingEngine";import type {
  HriEvent,
  SessionState as SessionStateV1,
  RhythmVectorScores,
} from "../types";
import type { ObservationSnapshot } from "./observationSnapshot";
import type { UnderstandingKnowledge } from "./informationGap";
import type { EvidenceItem, Probe, UnderstandingEntry } from "./questionCorePrototype";
import type { ContextGraph, PreviousProposalFeedback } from "../context/types";

export type Domain =
  | "memory"
  | "relationship"
  | "loss"
  | "work"
  | "future"
  | "hope"
  | "fear"
  | "identity";

export const DOMAINS: readonly Domain[] = [
  "memory", "relationship", "loss", "work",
  "future", "hope", "fear", "identity",
] as const;

export type DomainDistribution = Partial<Record<Domain, number>>;

export function dominantDomain(d: DomainDistribution): Domain | null {
  let best: Domain | null = null;
  let max = 0;
  for (const k of DOMAINS) {
    const v = d[k] ?? 0;
    if (v > max) { max = v; best = k; }
  }
  return best;
}

export type CurrentVector = {
  collapse: number;
  pressure: number;
  fragmentation: number;
  looping: number;
  avoidance: number;
  numbness: number;
  selfBlame: number;
  inwardMotion: number;
  outwardMotion: number;
  achievement: number;
  momentum: number;
  expansion: number;
  vitality: number;
  connection: number;
  relief: number;
};

type _AssertProtectionSubset = CurrentVector extends RhythmVectorScores ? true : never;
export type AssertProtectionSubset = _AssertProtectionSubset;

export type AxisGroup = "protection" | "growth" | "connection" | "direction";

export const AXIS_GROUP: Record<AxisGroup, readonly (keyof CurrentVector)[]> = {
  protection: ["collapse", "pressure", "fragmentation", "looping", "avoidance", "numbness", "selfBlame"],
  growth:     ["achievement", "momentum", "expansion", "vitality", "relief"],
  connection: ["connection"],
  direction:  ["inwardMotion", "outwardMotion"],
} as const;

export type ConfigAxisKey = keyof CurrentVector;

export const CONFIG_AXES: readonly ConfigAxisKey[] = [
  "collapse", "pressure", "fragmentation", "looping", "avoidance",
  "numbness", "selfBlame", "inwardMotion", "outwardMotion",
  "achievement", "momentum", "expansion", "vitality", "connection", "relief",
] as const;

export function dominantAxis(v: CurrentVector): ConfigAxisKey | null {
  let best: ConfigAxisKey | null = null;
  let max = 0;
  for (const k of CONFIG_AXES) {
    if (v[k] > max) { max = v[k]; best = k; }
  }
  return best;
}

export type SessionStateV2 = SessionStateV1 & {
  understanding?: UnderstandingState;
  coverage?: UnderstandingCoverage;
  lastAnswer?: string;
  lastProbedSlot?: Slot
  domains: DomainDistribution;
  currentVector: CurrentVector;
  domainHistory: DomainDistribution[];
  configHistory: CurrentVector[];
  /**
   * Internal only — the last (at most 2) slots a question was actually
   * returned for, used by the Observation OS overlay to detect role
   * repetition. Never read by the API/UI layer (sessionAdapter.ts
   * derives its response from event text, not from state).
   */
  recentSlots?: Slot[];
  /**
   * Internal runtime state only — the Observation OS's snapshot of
   * context/node/transition/goal/strategy as of the current completed
   * turn. Reflection does not read this yet (a later step wires that
   * up); never exposed via the API/UI layer for the same reason
   * recentSlots isn't (sessionAdapter.ts derives its response from
   * event text, not from state).
   */
  observationSnapshot?: ObservationSnapshot;
  /**
   * Sprint05 — persistent Slot Knowledge (provenance/sufficiency per
   * slot), carried turn-to-turn the same way understanding/coverage
   * are. Internal only, same visibility scope as recentSlots/
   * observationSnapshot — never exposed via the API/UI layer.
   */
  knowledge?: UnderstandingKnowledge;
  /**
   * Question Core Prototype 1 — internal only, same visibility scope as
   * knowledge/observationSnapshot (never exposed via the API/UI layer).
   * Carried turn-to-turn only when USE_PROTOTYPE_QUESTION_CORE is true
   * in controller.ts; unused and always undefined otherwise. Rollback
   * is a single flag flip in controller.ts, not a type change.
   */
  prototypeEvidence?: EvidenceItem[];
  prototypeUsedTriggers?: string[];
  /**
   * Gate 23 — Probe / Provisional Understanding, same visibility scope
   * as prototypeEvidence above (internal only, never exposed via the
   * API/UI layer, carried turn-to-turn only under
   * USE_PROTOTYPE_QUESTION_CORE). See questionCorePrototype.ts for the
   * types and the functions that produce these arrays.
   */
  prototypeProbes?: Probe[];
  prototypeUnderstanding?: UnderstandingEntry[];
  /**
   * Gate 26 — Intelligence Core Prototype 1, same visibility scope as
   * prototypeEvidence/prototypeProbes above (internal only, never
   * exposed via the API/UI layer, carried turn-to-turn only under
   * USE_INTELLIGENCE_CORE in controller.ts). Deliberately separate
   * from prototypeProbes/prototypeUnderstanding above — the two Cores
   * never share or mix state (Gate 26 §9). See
   * src/lib/hri/intelligence/intelligenceCore.ts and
   * src/lib/hri/context/types.ts for what these actually hold.
   */
  intelligenceGraph?: ContextGraph;
  intelligenceProbedRefs?: string[];
  intelligenceProposalFeedback?: PreviousProposalFeedback;
};

export type DomainSignal = {
  distribution: DomainDistribution;
  hits: Partial<Record<Domain, string[]>>;
};

export type DomainKeywordMap = Record<Domain, readonly string[]>;

export type DetectDomains = (latestAnswer: string) => DomainSignal;

export const DOMAIN_BLEND_WEIGHT = 0.55;

export type QuestionTree = {
  byAxis: Partial<Record<ConfigAxisKey, readonly string[]>>;
  default: readonly string[];
};

export type QuestionIndex = Record<Domain, QuestionTree>;

export type SelectProbe = (
  state: SessionStateV2,
  used: ReadonlySet<string>,
) => {
  domain: Domain | null;
  axis: ConfigAxisKey | null;
  question: string;
};
export type Slot =
  | "topic"
  | "target"
  | "emotion"
  | "relationship"
  | "presentState"
  | "meaning"
  | "wish";

export type PlannerDecision = {
  slot: Slot;
  anchor?: string;
};

export type SelectQuestion = (
  slot: Slot,
  anchor: string | undefined,
  used: ReadonlySet<string>,
) => { question: string };

export type ConvergenceReason =
  | "config_stable"
  | "hard_cap"
  | "not_converged"
  | "below_floor"
  | "min_turns";

export type ConvergenceParams = {
  epsilonConfig: number;
  epsilonDomain: number;
  axisFloor: number;
  minTurns: number;
  hardCap: number;
  stableTurnsRequired: number;
};

export type ConvergenceState = {
  converged: boolean;
  configDelta: number;
  domainDelta: number;
  confidence: number;
  reason: ConvergenceReason;
};

export type EvaluateConvergence = (
  state: SessionStateV2,
  params: ConvergenceParams,
) => ConvergenceState;

export const DEFAULT_CONVERGENCE_PARAMS: ConvergenceParams = {
  epsilonConfig: 0.12,
  epsilonDomain: 0.15,
  axisFloor: 0.2,
  minTurns: 2,
  hardCap: 8,
  stableTurnsRequired: 2,
};

export type FlowNode = {
  turn: number;
  domain: Domain | null;
  axis: ConfigAxisKey | null;
};

export type FlowCandidate = {
  from: FlowNode;
  to: FlowNode[];
  confirmed: boolean;
};

export type FlowReader = (state: SessionStateV2) => {
  trajectory: FlowNode[];
  candidates: FlowCandidate[];
};

export type ObservationTrigger = (conv: ConvergenceState) => boolean;

export type ObservationInput = {
  trajectory: FlowNode[];
  confirmedFlow: FlowCandidate[];
  answerTokens: string[];
};

export type { HriEvent };