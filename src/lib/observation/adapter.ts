/**
 * Observation Adapter — the only component allowed to emit
 * ObservationEvents.
 *
 *   HRI Engine → Observation Adapter → Observation Storage → Observation Console
 *
 * Receives raw event data, validates and normalizes it into an
 * ObservationEvent, and forwards it to whichever ObservationStorage
 * implementation the caller supplies. No business/Engine/Question/
 * Reflection logic, no UI, and no automatic emission — nothing calls
 * this yet; a future caller decides when (and whether) to.
 */

import type { ObservationEvent } from "./types";
import type { ObservationStorage, ObservationStorageResult } from "./storage";

const FIRST_INPUT_MAX_LENGTH = 500;

export type ObservationEventInput = {
  sessionId: unknown;
  firstInput: unknown;
  turnCount: unknown;
  reflectionCompleted: unknown;
  feedback?: unknown;
  timestamp?: unknown;
};

/** Reason string returned when input fails Adapter validation — exported so callers (e.g. route.ts) can map it to a 400 without re-implementing field checks. */
export const INVALID_OBSERVATION_EVENT_REASON = "Invalid ObservationEvent — failed Adapter validation.";

function validateAndNormalize(input: unknown): ObservationEvent | null {
  if (typeof input !== "object" || input === null) return null;

  const { sessionId, firstInput, turnCount, reflectionCompleted, feedback, timestamp } =
    input as ObservationEventInput;

  if (typeof sessionId !== "string" || !sessionId.trim()) return null;
  if (typeof firstInput !== "string") return null;
  if (typeof turnCount !== "number" || !Number.isInteger(turnCount) || turnCount < 0) return null;
  if (typeof reflectionCompleted !== "boolean") return null;
  if (feedback !== undefined && feedback !== null && typeof feedback !== "string") return null;
  if (timestamp !== undefined && typeof timestamp !== "string") return null;

  return {
    timestamp: typeof timestamp === "string" ? timestamp : new Date().toISOString(),
    sessionId: sessionId.trim(),
    firstInput: firstInput.slice(0, FIRST_INPUT_MAX_LENGTH),
    turnCount,
    reflectionCompleted,
    feedback: feedback === undefined ? null : (feedback as string | null),
  };
}

export async function emitObservationEvent(
  input: unknown,
  storage: ObservationStorage,
): Promise<ObservationStorageResult> {
  try {
    const event = validateAndNormalize(input);
    if (!event) {
      return {
        persisted: false,
        reason: INVALID_OBSERVATION_EVENT_REASON,
      };
    }

    return await storage.record(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Observation Adapter error";
    return { persisted: false, reason: message };
  }
}
