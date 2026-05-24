import type { HriEvent, SessionState } from "./types";
import { checkSafetyBoundary } from "./safetyBoundary";
import { detectRhythm } from "./rhythmDetection";
import { reduceSessionState } from "./reducer";
import { decideNextOutput } from "./pacing";
import { selectNextQuestion } from "./questionEngine";
import { createReflection } from "./reflectionEngine";
import { createQuestionEvent, createReflectionEvent, createSafetyEvent, createUserInputEvent } from "./events";

export type AdvanceSessionInput = {
  inputText: string;
  state: SessionState;
  events: HriEvent[];
};

export type AdvanceSessionResult = {
  state: SessionState;
  events: HriEvent[];
};

export function advanceSession({ inputText, state, events }: AdvanceSessionInput): AdvanceSessionResult {
  const trimmed = inputText.trim();
  if (!trimmed) return { state, events };

  const userEvent = createUserInputEvent(trimmed);
  const withUserInput = [...events, userEvent];

  const safety = checkSafetyBoundary(trimmed);
  if (!safety.safe) {
    return {
      state: { ...state, phase: "rest", pendingWhisper: false },
      events: [...withUserInput, createSafetyEvent(safety.message)],
    };
  }

  const rhythmSignal = detectRhythm(trimmed, events);
  const reducedState = reduceSessionState(state, rhythmSignal);
  const pacingDecision = decideNextOutput(reducedState);

  if (pacingDecision.kind === "reflection") {
    const nextState: SessionState = {
      ...reducedState,
      phase: pacingDecision.nextPhase,
      lastReflectionAtTurn: reducedState.turnCount,
      pendingWhisper: pacingDecision.pendingWhisper,
    };

    const reflection = createReflection(nextState, withUserInput);

    return {
      state: nextState,
      events: [...withUserInput, createReflectionEvent(reflection)],
    };
  }

  if (pacingDecision.kind === "rest") {
    return {
      state: {
        ...reducedState,
        phase: pacingDecision.nextPhase,
        pendingWhisper: pacingDecision.pendingWhisper,
      },
      events: withUserInput,
    };
  }

  const question = selectNextQuestion(reducedState, withUserInput);
  const nextState: SessionState = {
    ...reducedState,
    phase: pacingDecision.nextPhase,
    pendingWhisper: false,
    lastQuestionCategory: question.category,
    usedQuestionIds: [...reducedState.usedQuestionIds, question.id],
  };

  return {
    state: nextState,
    events: [...withUserInput, createQuestionEvent(question)],
  };
}
