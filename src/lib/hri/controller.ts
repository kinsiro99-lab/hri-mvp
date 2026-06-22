import type { HriEvent, SessionState, QuestionOutput, ReflectionOutput } from "./types";
import { checkSafetyBoundary } from "./safetyBoundary";
import { detectRhythm } from "./rhythmDetection";
import { reduceSessionState } from "./reducer";
import { decideNextOutput } from "./pacing";
import { advanceFlow, createFlowState } from "./flowController";

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
 // Pacing은 무출력 일시정지(rest)만 유지한다. reflection 소유권은 advanceFlow의
  // OBSERVATION 종료로 이관됐으므로 pacing의 reflection 표결은 사용하지 않는다.
  const pacingDecision = decideNextOutput(reducedState);
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

  // advanceFlow가 질문 / 미러 / observation의 단일 소유자다.
  const previousFlow = reducedState.flowState ?? createFlowState();
  const { step, state: nextFlow } = advanceFlow(trimmed, previousFlow);

  // OBSERVATION은 세션을 reflection으로 종료한다.
  if (step.kind === "observation") {
    const reflection: ReflectionOutput = {
      text: step.content,
      tone: "quiet",
      compressionLevel: "low",
    };
    const nextState: SessionState = {
      ...reducedState,
      phase: "reflection",
      lastReflectionAtTurn: reducedState.turnCount,
      pendingWhisper: false,
      flowState: nextFlow,
    };
    return {
      state: nextState,
      events: [...withUserInput, createReflectionEvent(reflection)],
    };
  }

  // ASK_* / MIRROR는 다음 질문/프롬프트로 렌더되고 입력을 기다린다.
  const question: QuestionOutput = {
    id: `flow-${step.layer}-${step.depth}-${reducedState.turnCount}`,
    text: step.content,
    category: reducedState.lastQuestionCategory ?? "density",
    aperture: "small",
    weight: 1,
  };
  const nextState: SessionState = {
    ...reducedState,
    phase: "probing",
    pendingWhisper: false,
    lastQuestionCategory: question.category,
    usedQuestionIds: [...reducedState.usedQuestionIds, question.id],
    flowState: nextFlow,
  };
  return {
    state: nextState,
    events: [...withUserInput, createQuestionEvent(question)],
  };
}