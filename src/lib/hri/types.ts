export type QuestionCategory =
  | "sensory"
  | "temporal"
  | "directional"
  | "density"
  | "fragmentation"
  | "boundary"
  | "silence";

export type WhisperMode =
  | "pacing"
  | "reduction"
  | "embodiment"
  | "continuation";

export type HriEvent =
  | {
      id: string;
      type: "user_input";
      text: string;
      createdAt: number;
    }
  | {
      id: string;
      type: "question";
      text: string;
      questionId: string;
      category: QuestionCategory;
      createdAt: number;
    }
  | {
      id: string;
      type: "reflection";
      text: string;
      createdAt: number;
    }
  | {
      id: string;
      type: "whisper";
      text: string;
      mode: WhisperMode;
      createdAt: number;
    }
  | {
      id: string;
      type: "safety";
      text: string;
      createdAt: number;
    };

export type RhythmVectorScores = {
  collapse: number;
  pressure: number;
  fragmentation: number;
  looping: number;
  avoidance: number;
  numbness: number;
  selfBlame: number;
  inwardMotion: number;
  outwardMotion: number;
};

export type SessionPhase =
  | "capture"
  | "probing"
  | "deepening"
  | "reflection"
  | "rest"
  | "whisper";

export type SessionState = {
  phase: SessionPhase;
  turnCount: number;
  depth: number;
  vectors: RhythmVectorScores;
  emotionalDensity: number;
  openness: number;
  exhaustion: number;
  repetition: number;
  lastQuestionCategory?: QuestionCategory;
  usedQuestionIds: string[];
  lastReflectionAtTurn?: number;
  pendingWhisper: boolean;
};

export type RhythmSignal = {
  vectors: Partial<RhythmVectorScores>;
  emotionalDensity: number;
  openness: number;
  exhaustion: number;
  repetition: number;
};

export type QuestionOutput = {
  id: string;
  text: string;
  category: QuestionCategory;
  aperture: "small" | "medium";
  weight: number;
};

export type ReflectionOutput = {
  text: string;
  tone: "quiet" | "still" | "dense";
  compressionLevel: "low" | "medium";
};

export type WhisperOutput = {
  text: string;
  mode: WhisperMode;
  delayMs: number;
  forceLevel: "low";
};

export type SafetyResult =
  | { safe: true }
  | { safe: false; message: string };

export type NextOutputKind = "question" | "reflection" | "rest";

export type PacingDecisionReason =
  | "continue_probing"
  | "minimum_turns_reached"
  | "max_question_turns_reached"
  | "high_exhaustion"
  | "high_repetition"
  | "low_openness"
  | "already_reflected";

export type PacingDecision = {
  kind: NextOutputKind;
  nextPhase: SessionPhase;
  reason: PacingDecisionReason;
  pendingWhisper: boolean;
};
