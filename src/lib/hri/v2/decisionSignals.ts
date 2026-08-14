/**
 * Decision Signals — Sprint09 foundation.
 *
 * Two pure, standalone signals for a future Decision Gate (not wired in
 * this Sprint — see decisionGate.ts, which still only reproduces
 * plannerExhaustedWithDepth). Neither function is called from
 * controller.ts, questionPlanner.ts, or decisionGate.ts yet.
 *
 * Both read only existing fields (SlotKnowledge.isLiteral,
 * SlotKnowledge.sufficient, hasEnoughDetail) — no new EvidenceKind, no
 * Gap Map change, no coverage change, no UnderstandingState change.
 */
import { ALL_SLOTS, type SlotKnowledge, type UnderstandingKnowledge } from "./informationGap";
import { hasEnoughDetail } from "./understandingEngine";

export type TargetUsefulness = "USEFUL" | "NEUTRAL" | "SELF_REFERENTIAL_OR_GENERIC";

/**
 * Sprint08 audit finding: provenance (EvidenceKind) does not predict
 * usefulness — a placeholder is always a generic representative label
 * (isLiteral === false) regardless of kind, and an explicit answer can
 * still be content-free (e.g. "그냥요"). `isLiteral` + `hasEnoughDetail`
 * reproduced every real CASE A~G example correctly in that audit;
 * `evidence.kind` is deliberately never read here.
 */
export function evaluateTargetUsefulness(
  targetKnowledge: SlotKnowledge | undefined,
): TargetUsefulness {
  if (!targetKnowledge) return "NEUTRAL";
  if (!targetKnowledge.isLiteral) return "SELF_REFERENTIAL_OR_GENERIC";
  if (!hasEnoughDetail(targetKnowledge.value)) return "SELF_REFERENTIAL_OR_GENERIC";
  return "USEFUL";
}

/**
 * Raw ground-truth count: how many of the 7 slots flipped from
 * not-sufficient (or absent) to sufficient between `prevKnowledge` and
 * `knowledge`. This is the number a caller should log/persist — the
 * LOW/HIGH interpretation below is provisional, not this.
 */
export function computeNewlySufficientThisTurn(
  prevKnowledge: UnderstandingKnowledge | undefined,
  knowledge: UnderstandingKnowledge,
): number {
  let count = 0;
  for (const slot of ALL_SLOTS) {
    const now = knowledge[slot];
    const before = prevKnowledge?.[slot];
    if (now?.sufficient && !before?.sufficient) count++;
  }
  return count;
}

export type ConversationDensity = "LOW" | "HIGH";

/**
 * Provisional interpretation only — computeNewlySufficientThisTurn()'s
 * raw count is the ground truth. Sprint08's audit observed exactly one
 * outlier (CASE "오랜 친구가 보고 싶다": 6) against every other traced
 * CASE (<= 2); this threshold is that observation, not a tuned or
 * finalized policy constant. Not read by any ASK/REFLECT decision yet.
 */
export function evaluateConversationDensity(
  newlySufficientThisTurn: number,
): ConversationDensity {
  return newlySufficientThisTurn >= 5 ? "HIGH" : "LOW";
}
