import { buildReflection } from "./v2/reflectionBuilder";
import type { HriEvent, SessionState, QuestionOutput, ReflectionOutput } from "./types";
import { checkSafetyBoundary } from "./safetyBoundary";
import { detectRhythm } from "./rhythmDetection";
import { reduceSessionState } from "./reducer";
import { decideNextOutput } from "./pacing";
import { advanceFlow, createFlowState } from "./flowController";
import {
  updateUnderstanding,
  shouldObserve,
} from "./v2/understandingEngine";
import {
  createQuestionEvent,
  createObservationEvent,
  createResonanceEvent,
  createReflectionEvent,
  createSafetyEvent,
  createUserInputEvent,
} from "./events";
import {
  planQuestion,
  planQuestionDecision,
} from "./v2/questionPlanner";
import { detectDomains } from "./v2/domainEngine";
import { reduceSessionStateV2 } from "./v2/reducerV2";
import { toCurrentVector, emptyCurrentVector } from "./v2/adapters";
import {
  selectProbe,
  selectQuestion,
} from "./v2/selector";
import { evaluateConvergence } from "./v2/convergence";
import { buildObservation } from "./v2/mirrorObservation";
import { validateAnswer } from "./v2/answerValidator";
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
    understanding: prevV2.understanding,
    coverage: prevV2.coverage,
    lastAnswer: trimmed,
    domainHistory: prevV2.domainHistory ?? [],
    configHistory: prevV2.configHistory ?? [],
  };

  const domainSignal = detectDomains(trimmed);
  const vectorSignal = toCurrentVector(rhythmSignal);
  const v2state = reduceSessionStateV2(v2base, domainSignal, vectorSignal);

  // 1) Understanding 갱신 — 이번 답으로 coverage를 채운다.
  const understandingUpdate = updateUnderstanding(v2state.understanding, trimmed);

  // 갱신된 이해/커버리지를 이후 모든 결정의 단일 출처로 삼는다.
  const hriState: SessionStateV2 = {
    ...v2state,
    understanding: understandingUpdate.next,
    coverage: understandingUpdate.coverage,
    lastAnswer: trimmed,
  };

  const coverage = understandingUpdate.coverage;

  // 2) 종료 조건 — coverage 충분 or 턴 초과면 Observation.
  const convergence = evaluateConvergence(hriState, DEFAULT_CONVERGENCE_PARAMS);
  const coverageDone = shouldObserve(
    understandingUpdate.next,
    coverage,
    hriState.turnCount
);
  const minimumObservationTurns = 4;
  const canReflect = hriState.turnCount >= minimumObservationTurns;
  console.log("OBSERVE CHECK:", {
  turnCount: hriState.turnCount,
  coverageDone,
  convergence: convergence.converged,
  coverage,
  updateCoverage: understandingUpdate.coverage,
});
  if (canReflect && (coverageDone || convergence.converged)) {
    const probe = selectProbe(hriState, new Set(hriState.usedQuestionIds));

    // Flow Summary + Observation 3단 구조.
    const flowSummary = "";
    const reflectionResult = buildReflection(understandingUpdate.next);
    const obs = buildObservation(convergence, probe.domain, probe.axis, trimmed, []);
    const nextDirection =
      understandingUpdate.next.wish
        ? `지금 마음이 향하는 곳은 '${understandingUpdate.next.wish}' 쪽으로 보입니다.`
        : "지금은 무엇을 하기보다, 떠오른 것을 잠시 그대로 바라보는 자리에 가깝습니다.";

   const observationText = obs?.text ?? "";

const reflectionText = [
    reflectionResult.title,
    reflectionResult.body,
    reflectionResult.closing,
]
.filter(s => s && s.trim().length > 0)
.join("\n\n");

    const reflection: ReflectionOutput = {
      text: reflectionText,
      tone: "quiet",
      compressionLevel: "low",
    };

    const nextState: SessionStateV2 = {
      ...hriState,
      phase: "reflection",
      lastReflectionAtTurn: hriState.turnCount,
      pendingWhisper: false,
    };

    return {
      state: nextState,
      events: [...withUserInput, createReflectionEvent(reflection)],
    };
  }

  // 3) Planner 우선 — 미충족 슬롯을 겨냥한 질문.
  const plannerDecision = planQuestionDecision(
  understandingUpdate.next,
  coverage,
);

  // 4) Planner가 null이면 selector fallback (used에 직전 답변 검증 반영).
  const usedSet = new Set<string>(hriState.usedQuestionIds);
  const lastQuestionText = [...withUserInput]
    .reverse()
    .find((event) => event.type === "question")?.text ?? "";
  const answerValidation = validateAnswer(lastQuestionText, trimmed);
  if (answerValidation.completed && lastQuestionText) {
    usedSet.add(lastQuestionText);
  }

 const probe = selectProbe(hriState, usedSet);

const finalText =
  plannerDecision !== null
    ? selectQuestion(
        plannerDecision.slot,
        plannerDecision.anchor,
        usedSet,
      ).question
    : probe.question;

  const question: QuestionOutput = {
    id: `v2-${probe.domain ?? "none"}-${probe.axis ?? "none"}-${hriState.turnCount}`,
    text: finalText,
    category: hriState.lastQuestionCategory ?? "density",
    aperture: "small",
    weight: 1,
  };

  const nextState: SessionStateV2 = {
    ...hriState,
    phase: "probing",
    pendingWhisper: false,
    lastQuestionCategory: question.category,
    usedQuestionIds: [...hriState.usedQuestionIds, question.text],
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