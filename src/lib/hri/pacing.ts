import type { PacingDecision, SessionState } from "./types";

const MIN_REFLECTION_TURN = 3;
const MAX_QUESTION_TURNS = 4;

function hasAlreadyReflectedThisTurn(state: SessionState) {
  return state.lastReflectionAtTurn === state.turnCount;
}

function makeDecision(decision: PacingDecision): PacingDecision {
  return decision;
}

export function decideNextOutput(state: SessionState): PacingDecision {
  if (hasAlreadyReflectedThisTurn(state)) {
    return makeDecision({
      kind: "rest",
      nextPhase: "rest",
      reason: "already_reflected",
      pendingWhisper: state.pendingWhisper,
    });
  }

  if (state.turnCount >= MAX_QUESTION_TURNS) {
    return makeDecision({
      kind: "reflection",
      nextPhase: "reflection",
      reason: "max_question_turns_reached",
      pendingWhisper: true,
    });
  }

  if (state.turnCount >= MIN_REFLECTION_TURN) {
    return makeDecision({
      kind: "reflection",
      nextPhase: "reflection",
      reason: "minimum_turns_reached",
      pendingWhisper: true,
    });
  }

  if (state.turnCount >= 2 && state.exhaustion >= 0.72) {
    return makeDecision({
      kind: "reflection",
      nextPhase: "reflection",
      reason: "high_exhaustion",
      pendingWhisper: true,
    });
  }

  if (state.turnCount >= 2 && state.repetition >= 0.68) {
    return makeDecision({
      kind: "reflection",
      nextPhase: "reflection",
      reason: "high_repetition",
      pendingWhisper: true,
    });
  }

  if (state.turnCount >= 2 && state.openness <= 0.12 && state.emotionalDensity >= 0.55) {
    return makeDecision({
      kind: "reflection",
      nextPhase: "reflection",
      reason: "low_openness",
      pendingWhisper: true,
    });
  }

  return makeDecision({
    kind: "question",
    nextPhase: state.turnCount >= 2 ? "deepening" : "probing",
    reason: "continue_probing",
    pendingWhisper: false,
  });
}
