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

import type { ObservationEvent, ObservationReflection, ObservationTurn } from "./types";

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
}

export class NoopObservationStorage implements ObservationStorage {
  async record(_event: ObservationEvent): Promise<ObservationStorageResult> {
    return {
      persisted: false,
      reason: "No storage backend configured yet — Observation Console logging is contract-only in this sprint.",
    };
  }

  async recordTurn(_turn: ObservationTurn): Promise<ObservationStorageResult> {
    return {
      persisted: false,
      reason: "No storage backend configured yet — Observation Console logging is contract-only in this sprint.",
    };
  }

  async recordReflection(_reflection: ObservationReflection): Promise<ObservationStorageResult> {
    return {
      persisted: false,
      reason: "No storage backend configured yet — Observation Console logging is contract-only in this sprint.",
    };
  }
}
