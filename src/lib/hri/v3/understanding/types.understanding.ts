/**
 * ===========================================================
 * HRI V3 Understanding Engine
 * Core Type Contracts
 * ===========================================================
 */

export type Slot =
  | "topic"
  | "target"
  | "emotion"
  | "relationship"
  | "presentState"
  | "meaning"
  | "wish"
  | "pressure";

export const SLOTS: readonly Slot[] = [
  "topic",
  "target",
  "emotion",
  "relationship",
  "presentState",
  "meaning",
  "wish",
  "pressure",
] as const;

export type SignalSet = {
  strength: Partial<Record<Slot, number>>;
  value: Partial<Record<Slot, string>>;
};

export type SlotNode = {
  slot: Slot;
  strength: number;
  confidence: number;
  value?: string;
  activations: number;
  lastTurn: number;
};

export type SlotLink = {
  a: Slot;
  b: Slot;
  weight: number;
};

export type UnderstandingGraph = {
  nodes: Partial<Record<Slot, SlotNode>>;
  links: SlotLink[];
  turn: number;
};

export type Coverage = {
  perSlot: Partial<Record<Slot, number>>;
  score: number;
  confident: Partial<Record<Slot, boolean>>;
};

export type CoverageParams = {
  slotThreshold: number;
  confThreshold: number;
  scoreThreshold: number;
};

export const DEFAULT_COVERAGE_PARAMS: CoverageParams = {
  slotThreshold: 0.4,
  confThreshold: 0.5,
  scoreThreshold: 0.7,
};