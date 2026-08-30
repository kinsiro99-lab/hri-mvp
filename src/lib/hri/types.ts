import type { FlowState } from "./flowController";

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
      // Reality Gain Observation Sprint 02 — optional, read-only
      // structural-change summary for THIS turn (see StructuralChangeSummary
      // in intelligence/intelligenceCore.ts). Flat primitives rather than
      // a nested/imported type, matching this union's existing style and
      // avoiding a new cross-module import here. Undefined whenever
      // USE_INTELLIGENCE_CORE's branch didn't run this turn.
      structuralNewElements?: number;
      structuralUpdatedElements?: number;
      structuralNewRelations?: number;
      structuralElementRef?: string | null;
    }
  | {
      id: string;
      type: "reflection";
      text: string;
      createdAt: number;
      // Reality Gain Observation Sprint 02 — same fields/meaning as the
      // "question" variant above.
      structuralNewElements?: number;
      structuralUpdatedElements?: number;
      structuralNewRelations?: number;
      structuralElementRef?: string | null;
    }
  | {
      id: string;
      type: "observation";
      text: string;
      createdAt: number;
    }
  | {
      id: string;
      type: "resonance";
      pauseMs: number;
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
 positiveValence: number;
 achievementScore: number;
 recoveryScore: number;
 vitalityScore: number;
 connectionScore: number;
 lastQuestionCategory?: QuestionCategory;
  usedQuestionIds: string[];
   lastReflectionAtTurn?: number;
  pendingWhisper: boolean;
  flowState?: FlowState;
};

export type RhythmSignal = {
  achievementScore?: number;
recoveryScore?: number;
vitalityScore?: number;
connectionScore?: number;
  vectors: Partial<RhythmVectorScores>;
  emotionalDensity: number;
  openness: number;
  exhaustion: number;
  repetition: number;
    // P0 (임시)
  // P1에서 Achievement/Momentum/Calm/Connection/Expansion/Relief
  // 6축의 집계값으로 대체
  positiveValence?: number;
};

export type QuestionOutput = {
  id: string;
  text: string;
  category: QuestionCategory;
  aperture: "small" | "medium";
  weight: number;
  // Reality Gain Observation Sprint 02 — see HriEvent's "question"
  // variant above; copied through verbatim by createQuestionEvent.
  structuralNewElements?: number;
  structuralUpdatedElements?: number;
  structuralNewRelations?: number;
  structuralElementRef?: string | null;
};

export type ReflectionOutput = {
  text: string;
  tone: "quiet" | "still" | "dense";
  compressionLevel: "low" | "medium";
  // Reality Gain Observation Sprint 02 — see HriEvent's "reflection"
  // variant above; copied through verbatim by createReflectionEvent.
  structuralNewElements?: number;
  structuralUpdatedElements?: number;
  structuralNewRelations?: number;
  structuralElementRef?: string | null;
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
