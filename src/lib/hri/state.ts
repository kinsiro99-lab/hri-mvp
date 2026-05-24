import type { SessionState, RhythmVectorScores } from "./types";

export const emptyVectors: RhythmVectorScores = {
  collapse: 0,
  pressure: 0,
  fragmentation: 0,
  looping: 0,
  avoidance: 0,
  numbness: 0,
  selfBlame: 0,
  inwardMotion: 0,
  outwardMotion: 0,
};

export const initialSessionState: SessionState = {
  phase: "capture",
  turnCount: 0,
  depth: 0,
  vectors: emptyVectors,
  emotionalDensity: 0,
  openness: 0,
  exhaustion: 0,
  repetition: 0,
  usedQuestionIds: [],
  pendingWhisper: false,
};
