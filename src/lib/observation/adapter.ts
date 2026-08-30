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

import type { ObservationEvent, ObservationReflection, ObservationRealityGain, ObservationTurn, RealityGainType } from "./types";
import type { ObservationStorage, ObservationStorageResult } from "./storage";

const FIRST_INPUT_MAX_LENGTH = 500;
// Question Observation Foundation Sprint 01 — generous but bounded,
// same defensive intent as FIRST_INPUT_MAX_LENGTH above (a stray huge
// payload should truncate, never fail the whole write).
const QUESTION_TEXT_MAX_LENGTH = 2000;
const ANSWER_TEXT_MAX_LENGTH = 2000;
const REFLECTION_TEXT_MAX_LENGTH = 20000;

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

// Question Observation Foundation Sprint 01 — same
// validate-then-delegate shape as emitObservationEvent above, kept as
// plain function parameters (not a FormData-shaped input type) since
// both callers are internal (api/analyze/route.ts), not a public HTTP
// body like ObservationEventInput above.
export async function emitObservationTurn(
  input: { sessionId: string; turnIndex: number; questionText: string; questionRef: string | null; answerText: string },
  storage: ObservationStorage,
): Promise<ObservationStorageResult> {
  try {
    if (!input.sessionId.trim() || !input.questionText.trim() || !input.answerText.trim()) {
      return { persisted: false, reason: INVALID_OBSERVATION_EVENT_REASON };
    }
    if (!Number.isInteger(input.turnIndex) || input.turnIndex < 0) {
      return { persisted: false, reason: INVALID_OBSERVATION_EVENT_REASON };
    }

    const turn: ObservationTurn = {
      timestamp: new Date().toISOString(),
      sessionId: input.sessionId.trim(),
      turnIndex: input.turnIndex,
      questionText: input.questionText.slice(0, QUESTION_TEXT_MAX_LENGTH),
      questionRef: input.questionRef,
      answerText: input.answerText.slice(0, ANSWER_TEXT_MAX_LENGTH),
    };

    return await storage.recordTurn(turn);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Observation Adapter error";
    return { persisted: false, reason: message };
  }
}

export async function emitObservationReflection(
  input: { sessionId: string; reflectionText: string },
  storage: ObservationStorage,
): Promise<ObservationStorageResult> {
  try {
    if (!input.sessionId.trim() || !input.reflectionText.trim()) {
      return { persisted: false, reason: INVALID_OBSERVATION_EVENT_REASON };
    }

    const reflection: ObservationReflection = {
      timestamp: new Date().toISOString(),
      sessionId: input.sessionId.trim(),
      reflectionText: input.reflectionText.slice(0, REFLECTION_TEXT_MAX_LENGTH),
    };

    return await storage.recordReflection(reflection);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Observation Adapter error";
    return { persisted: false, reason: message };
  }
}

// Reality Gain Observation Sprint 02 — classifies gainType purely
// from the three counts already computed by intelligenceCore.ts's
// updateGraph() (see StructuralChangeSummary there). No wording, no
// answer length, no emotion detection, no LLM judge call — exactly
// the boundary the Sprint requires. Priority when a turn produced
// more than one kind of change: NEW_REALITY > RELATION > CLARIFICATION.
function classifyGain(newElementCount: number, updatedElementCount: number, newRelationCount: number): RealityGainType {
  if (newElementCount > 0) return "NEW_REALITY";
  if (newRelationCount > 0) return "RELATION";
  if (updatedElementCount > 0) return "CLARIFICATION";
  return "NO_STRUCTURAL_GAIN";
}

export async function emitObservationRealityGain(
  input: {
    sessionId: string;
    turnIndex: number;
    newElementCount: number;
    updatedElementCount: number;
    newRelationCount: number;
    elementRef: string | null;
  },
  storage: ObservationStorage,
): Promise<ObservationStorageResult> {
  try {
    if (!input.sessionId.trim()) {
      return { persisted: false, reason: INVALID_OBSERVATION_EVENT_REASON };
    }
    if (!Number.isInteger(input.turnIndex) || input.turnIndex < 0) {
      return { persisted: false, reason: INVALID_OBSERVATION_EVENT_REASON };
    }

    const gain: ObservationRealityGain = {
      timestamp: new Date().toISOString(),
      sessionId: input.sessionId.trim(),
      turnIndex: input.turnIndex,
      gainType: classifyGain(input.newElementCount, input.updatedElementCount, input.newRelationCount),
      newElementCount: input.newElementCount,
      updatedElementCount: input.updatedElementCount,
      newRelationCount: input.newRelationCount,
      elementRef: input.elementRef,
    };

    return await storage.recordRealityGain(gain);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Observation Adapter error";
    return { persisted: false, reason: message };
  }
}
