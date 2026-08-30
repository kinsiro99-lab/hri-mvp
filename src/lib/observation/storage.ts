/**
 * Storage contract for Observation Console logging. Backend-agnostic
 * on purpose — a future adapter (Neon, Supabase, S3, an analytics
 * sink) implements this same interface without changing callers or
 * the ObservationEvent schema.
 *
 * Not wired into route.ts/logStore.ts yet. This sprint only defines
 * the contract; NoopObservationStorage exists so the interface has a
 * concrete, honest implementation, matching the no-op already used
 * in src/lib/hri/logStore.ts.
 */

import type { ObservationEvent, ObservationReflection, ObservationRealityGain, ObservationQuestionQuality, ObservationTurn } from "./types";

export type ObservationStorageResult = {
  persisted: boolean;
  reason?: string;
};

export interface ObservationStorage {
  record(event: ObservationEvent): Promise<ObservationStorageResult>;
  // Question Observation Foundation Sprint 01 — additive methods,
  // same never-throws/fail-soft contract as record() above.
  recordTurn(turn: ObservationTurn): Promise<ObservationStorageResult>;
  recordReflection(reflection: ObservationReflection): Promise<ObservationStorageResult>;
  // Reality Gain Observation Sprint 02 — same contract.
  recordRealityGain(gain: ObservationRealityGain): Promise<ObservationStorageResult>;
  // Question Quality Evaluation V1 Sprint 03 — same contract.
  recordQuestionQuality(quality: ObservationQuestionQuality): Promise<ObservationStorageResult>;
}

const NOT_CONFIGURED_REASON = "No storage backend configured yet — Observation Console logging is contract-only in this sprint.";

export class NoopObservationStorage implements ObservationStorage {
  async record(_event: ObservationEvent): Promise<ObservationStorageResult> {
    return { persisted: false, reason: NOT_CONFIGURED_REASON };
  }

  async recordTurn(_turn: ObservationTurn): Promise<ObservationStorageResult> {
    return { persisted: false, reason: NOT_CONFIGURED_REASON };
  }

  async recordReflection(_reflection: ObservationReflection): Promise<ObservationStorageResult> {
    return { persisted: false, reason: NOT_CONFIGURED_REASON };
  }

  async recordRealityGain(_gain: ObservationRealityGain): Promise<ObservationStorageResult> {
    return { persisted: false, reason: NOT_CONFIGURED_REASON };
  }

  async recordQuestionQuality(_quality: ObservationQuestionQuality): Promise<ObservationStorageResult> {
    return { persisted: false, reason: NOT_CONFIGURED_REASON };
  }
}
