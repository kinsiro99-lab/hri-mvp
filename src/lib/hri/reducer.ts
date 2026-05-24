import type { RhythmSignal, RhythmVectorScores, SessionState } from "./types";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function blend(previous: number, next: number, weight = 0.35) {
  return clamp01(previous * (1 - weight) + next * weight);
}

function mergeVectors(previous: RhythmVectorScores, signal: Partial<RhythmVectorScores>): RhythmVectorScores {
  return {
    collapse: blend(previous.collapse, signal.collapse ?? 0),
    pressure: blend(previous.pressure, signal.pressure ?? 0),
    fragmentation: blend(previous.fragmentation, signal.fragmentation ?? 0),
    looping: blend(previous.looping, signal.looping ?? 0),
    avoidance: blend(previous.avoidance, signal.avoidance ?? 0),
    numbness: blend(previous.numbness, signal.numbness ?? 0),
    selfBlame: blend(previous.selfBlame, signal.selfBlame ?? 0),
    inwardMotion: blend(previous.inwardMotion, signal.inwardMotion ?? 0),
    outwardMotion: blend(previous.outwardMotion, signal.outwardMotion ?? 0),
  };
}

export function reduceSessionState(previous: SessionState, signal: RhythmSignal): SessionState {
  const nextTurnCount = previous.turnCount + 1;

  return {
    ...previous,
    turnCount: nextTurnCount,
    depth: nextTurnCount >= 2 ? Math.min(3, previous.depth + 1) : previous.depth,
    vectors: mergeVectors(previous.vectors, signal.vectors),
    emotionalDensity: blend(previous.emotionalDensity, signal.emotionalDensity),
    openness: blend(previous.openness, signal.openness),
    exhaustion: blend(previous.exhaustion, signal.exhaustion),
    repetition: blend(previous.repetition, signal.repetition),
  };
}
