import type { HriEvent, SessionState, QuestionOutput, ReflectionOutput } from "./types";
import { checkSafetyBoundary } from "./safetyBoundary";
import { detectRhythm } from "./rhythmDetection";
import { reduceSessionState } from "./reducer";
import { decideNextOutput } from "./pacing";
import { advanceFlow, createFlowState } from "./flowController";

import { createQuestionEvent, createReflectionEvent, createSafetyEvent, createUserInputEvent } from "./events";

import { detectDomains } from "./v2/domainEngine";
import { reduceSessionStateV2 } from "./v2/reducerV2";
import { toCurrentVector, emptyCurrentVector } from "./v2/adapters";
import { selectProbe } from "./v2/selector";
import { evaluateConvergence } from "./v2/convergence";
import { buildObservation } from "./v2/mirrorObservation";

import {
  DEFAULT_CONVERGENCE_PARAMS,
  type SessionStateV2,
} from "./v2/types.v2";

const HRI_V2 = true;

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

if (HRI_V2) {
  const baseV1 = reduceSessionState(state, rhythmSignal);
  const prevV2 = state as Partial<SessionStateV2>;

  const v2base: SessionStateV2 = {
    ...baseV1,
    domains: prevV2.domains ?? {},
    currentVector: prevV2.currentVector ?? emptyCurrentVector(),
    domainHistory: prevV2.domainHistory ?? [],
    configHistory: prevV2.configHistory ?? [],
  };

  const domainSignal = detectDomains(trimmed);
  const vectorSignal = toCurrentVector(rhythmSignal);
  const v2state = reduceSessionStateV2(v2base, domainSignal, vectorSignal);

  const convergence = evaluateConvergence(v2state, DEFAULT_CONVERGENCE_PARAMS);
  const usedSet = new Set<string>(v2state.usedQuestionIds);

  if (convergence.converged) {
    const probe = selectProbe(v2state, usedSet);
    const obs = buildObservation(convergence, probe.domain, probe.axis, trimmed, []);
    const reflection: ReflectionOutput = {
      text: obs?.text ?? "",
      tone: "quiet",
      compressionLevel: "low",
    };

    const nextState: SessionStateV2 = {
      ...v2state,
      phase: "reflection",
      lastReflectionAtTurn: v2state.turnCount,
      pendingWhisper: false,
    };

    return {
      state: nextState,
      events: [...withUserInput, createReflectionEvent(reflection)],
    };
  }

  const probe = selectProbe(v2state, usedSet);
  const question: QuestionOutput = {
    id: `v2-${probe.domain ?? "none"}-${probe.axis ?? "none"}-${v2state.turnCount}`,
    text: probe.question,
    category: v2state.lastQuestionCategory ?? "density",
    aperture: "small",
    weight: 1,
  };

  const nextState: SessionStateV2 = {
    ...v2state,
    phase: "probing",
    pendingWhisper: false,
    lastQuestionCategory: question.category,
    usedQuestionIds: [...v2state.usedQuestionIds, question.text],
  };

  return {
    state: nextState,
    events: [...withUserInput, createQuestionEvent(question)],
  };
}

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