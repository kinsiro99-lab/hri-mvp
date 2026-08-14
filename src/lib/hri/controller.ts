import { composeReflection } from "./v2/reflectionComposer";
import type { HriEvent, SessionState, QuestionOutput, ReflectionOutput } from "./types";
import { devLog } from "../devLog";
import { checkSafetyBoundary } from "./safetyBoundary";
import { detectRhythm } from "./rhythmDetection";
import { reduceSessionState } from "./reducer";
import { decideNextOutput } from "./pacing";
import { advanceFlow, createFlowState } from "./flowController";
import { NEUTRAL_DEEPENING } from "./v2/neutralQuestions";

import {
  updateUnderstanding,
  shouldObserve,
  coverageDetailScore,
  COVERAGE_THRESHOLD,
  hasEnoughDetail,
} from "./v2/understandingEngine";
import {
  createQuestionEvent,
  createObservationEvent,
  createResonanceEvent,
  createReflectionEvent,
  createSafetyEvent,
  createUserInputEvent,
  getUserInputTexts,
} from "./events";
import {
  planQuestionDecision,
} from "./v2/questionPlanner";
import { buildGapMap } from "./v2/informationGap";
import { decideDecisionGate } from "./v2/decisionGate";
import { detectObservationContext } from "./v2/observationContext";
import type { ObservationContext } from "./v2/observationContext";
import { planObservation } from "./v2/observationPlanner";
import type { ObservationPlan } from "./v2/observationPlanner";
import { buildObservationSnapshot } from "./v2/observationSnapshot";
import type { ObservationSnapshot } from "./v2/observationSnapshot";
import { buildReflectionHint } from "./v2/reflectionHint";
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
    // Policy: build a fresh current-turn fallback snapshot rather than
    // preserving whatever snapshot the previous turn left behind — this
    // turn never entered the V2 pipeline (no Understanding/coverage
    // update happens here), so there is nothing to plan a transition or
    // goal from, and none is fabricated. Context/confidence are still
    // real (detectObservationContext is a stateless, pure classifier —
    // computing it doesn't touch Understanding or the safety decision
    // itself), just gated by an explicit safety reason instead of the
    // usual Beta scope/confidence reasons. turnCount is NOT incremented
    // here because reduceSessionState never runs on this path — this
    // turn's input was not processed, so state.turnCount is already the
    // correct "after processing" value for this branch (unchanged).
    let abortContext: ObservationContext = "uncertain";
    let abortConfidence = 0;
    try {
      const observation = detectObservationContext(trimmed);
      abortContext = observation.context;
      abortConfidence = observation.confidence;
    } catch {
      abortContext = "uncertain";
      abortConfidence = 0;
    }

    const abortSnapshot = buildObservationSnapshot({
      turnCount: state.turnCount,
      context: abortContext,
      contextConfidence: abortConfidence,
      plan: null,
      fallbackReason: "safety-abort: input flagged unsafe, no observation processing performed",
    });

    const abortState: SessionState & { observationSnapshot?: ObservationSnapshot } = {
      ...state,
      phase: "rest",
      pendingWhisper: false,
      observationSnapshot: abortSnapshot,
    };

    return {
      state: abortState,
      events: [...withUserInput, createSafetyEvent(safety.message)],
    };
  }

  const rhythmSignal = detectRhythm(trimmed, events);

if (HRI_V2) {
  const baseV1 = reduceSessionState(state, rhythmSignal);
  const prevV2 = state as Partial<SessionStateV2>;
  // Captured before the new observationSnapshot is built below, so
  // ReflectionHint can conservatively fall back to it (Step 5) without
  // ever reading the not-yet-overwritten current turn's value by mistake.
  const previousObservationSnapshot = prevV2.observationSnapshot;

  const v2base: SessionStateV2 = {
    ...baseV1,
    domains: prevV2.domains ?? {},
    currentVector: prevV2.currentVector ?? emptyCurrentVector(),
    understanding: prevV2.understanding,
    coverage: prevV2.coverage,
    lastAnswer: trimmed,
    lastProbedSlot: prevV2.lastProbedSlot,
    domainHistory: prevV2.domainHistory ?? [],
    configHistory: prevV2.configHistory ?? [],
  };

  const domainSignal = detectDomains(trimmed);
  const vectorSignal = toCurrentVector(rhythmSignal);
  const v2state = reduceSessionStateV2(v2base, domainSignal, vectorSignal);

  // 1) Understanding 갱신 — 이번 답으로 coverage를 채운다.
  // Sprint09 — v2state.turnCount (reduceSessionState가 이미 이번 턴 값으로
  // 증가시켜 놓음) 을 그대로 넘겨 이번 턴 새로 생성되는 Evidence마다
  // turn을 기록한다. decideNextSlot/coverage/질문 선택 로직에는 영향 없음
  // — Evidence.turn은 devLog/향후 신호 계산 전용이며 어떤 분기 조건에도
  // 쓰이지 않는다.
  const understandingUpdate = updateUnderstanding(
    v2state.understanding,
    trimmed,
    prevV2.lastProbedSlot,
    prevV2.knowledge,
    v2state.turnCount,
);

  // 갱신된 이해/커버리지를 이후 모든 결정의 단일 출처로 삼는다.
  const hriState: SessionStateV2 = {
    ...v2state,
    understanding: understandingUpdate.next,
    coverage: understandingUpdate.coverage,
    // Sprint05 — persistent Slot Knowledge, merged inside
    // updateUnderstanding() (fresh evidence this turn, else the prior
    // turn's knowledge when it still explains the current value — see
    // informationGap.ts's mergeUnderstandingKnowledge). Persisted here
    // and carried turn-to-turn the same way understanding/coverage are,
    // but not read by any question/Reflection decision below yet — see
    // the Gap Map note further down for why that wiring was reverted.
    knowledge: understandingUpdate.knowledge,
    lastAnswer: trimmed,
  };

  const coverage = understandingUpdate.coverage;

  // Sprint05 — computed every turn purely for observability/future use
  // (devLog only). A gap-aware fallback that fed this into
  // planQuestionDecision() was built and tested, then reverted before
  // commit: it changed plannerDecision from null to non-null at exactly
  // the boundary plannerExhaustedWithDepth (below) reads, indirectly
  // shifting Reflection timing, and re-surfaced placeholder/sideEffect
  // slots as real questions in ways that read as regression. Question
  // Decision and Stop/Reflection readiness are coupled closely enough
  // that they need to be redesigned together, not touched independently
  // — a future Sprint. Until then this map exists and is accurate, but
  // nothing downstream consumes it.
  const gapMap = buildGapMap(understandingUpdate.knowledge);
  devLog("GAP MAP:", gapMap);

  // The literal text the user just gave for whatever slot was probed
  // last turn (undefined if nothing was probed, or the answer was too
  // weak/short to count — same hasEnoughDetail gate updateUnderstanding
  // itself uses). Passed to the planner as the preferred anchor source:
  // the newest concrete thing the user said, instead of a stale emotion
  // label frozen from several turns earlier.
  //
  // "topic" is excluded: unlike the other 6 slots, it's never filled via
  // probedFor() with the user's literal text — it's always the engine's
  // own internal classification label (e.g. "몸 상태"/"기억"/"관계"), so
  // reading it here would quote that category label back at the user as
  // if it were their own words (the same leak withAnchor()'s emotion-only
  // fallback was written to avoid).
  const freshAnswer =
    prevV2.lastProbedSlot && prevV2.lastProbedSlot !== "topic" && hasEnoughDetail(trimmed)
      ? understandingUpdate.next[prevV2.lastProbedSlot]
      : undefined;

  // 2) 종료 조건 — coverage 충분 or 턴 초과면 Observation.
  const convergence = evaluateConvergence(hriState, DEFAULT_CONVERGENCE_PARAMS);
  const coverageDone = shouldObserve(
    understandingUpdate.next,
    coverage,
    hriState.turnCount
);
  const minimumObservationTurns = 4;
  const canReflect = hriState.turnCount >= minimumObservationTurns;
  devLog("OBSERVE CHECK:", {
  turnCount: hriState.turnCount,
  coverageDone,
  convergence: convergence.converged,
  coverage,
  updateCoverage: understandingUpdate.coverage,
});

  // 3) Planner 우선 — 미충족 슬롯을 겨냥한 질문.
  // Computed here (before the reflection branch, not just in the
  // question branch below) so the Observation Snapshot right after it
  // reflects this turn's real planner state on every normal turn,
  // including the one that triggers Reflection — never a carried-
  // forward value from a previous turn. Pure function, no side effects,
  // so moving it earlier changes nothing else about its result.
  const plannerDecision = planQuestionDecision(
    understandingUpdate.next,
    coverage,
    freshAnswer,
  );

  // --- Observation OS context/plan (Beta, individual/organization only) ---
  // Computed once per turn and shared by the Observation Snapshot below
  // (used on every normal turn, reflection or question) and by the
  // question-branch overlay further down. Never touches Understanding
  // or coverage; any failure here falls back to safe/uncertain defaults
  // and a "fallback" snapshot, never a fabricated transition or goal.
  const recentSlotsForObservation = hriState.recentSlots ?? [];
  let snapshotContext: ObservationContext = "uncertain";
  let snapshotConfidence = 0;
  let observationPlan: ObservationPlan | null = null;
  let planReason = "observation context not yet evaluated";

  try {
    // detectObservationContext's confidence = dominance * min(1, hits/3):
    // a single, wholly unambiguous keyword (no competing context) caps at
    // ~0.33 — that's the realistic ceiling for the short, single-signal
    // inputs this Beta targets, not a weak signal. 0.33 is treated as the
    // "medium" floor; anything below (i.e. a competing context reduced
    // dominance) stays in "low confidence" and falls back.
    const BETA_MIN_CONFIDENCE = 0.33;
    const accumulatedText = getUserInputTexts(withUserInput).join(" ");
    const observation = detectObservationContext(accumulatedText);
    snapshotContext = observation.context;
    snapshotConfidence = observation.confidence;

    if (plannerDecision === null) {
      planReason = "no planner decision this turn — node/transition/goal not applicable";
    } else if (observation.context !== "individual" && observation.context !== "organization") {
      planReason = `context "${observation.context}" is outside Beta planning scope`;
    } else if (observation.confidence < BETA_MIN_CONFIDENCE) {
      planReason = `confidence ${observation.confidence.toFixed(2)} below Beta threshold ${BETA_MIN_CONFIDENCE}`;
    } else {
      observationPlan = planObservation(
        observation.context,
        plannerDecision.slot,
        coverage,
        recentSlotsForObservation,
      );
      planReason = observationPlan.reason;
    }
  } catch {
    snapshotContext = "uncertain";
    snapshotConfidence = 0;
    observationPlan = null;
    planReason = "error during observation context/planning — fallback";
  }

  const observationSnapshot = buildObservationSnapshot({
    turnCount: hriState.turnCount,
    context: snapshotContext,
    contextConfidence: snapshotConfidence,
    plan: observationPlan,
    fallbackReason: planReason,
  });

  // Sprint06 — Decision Gate Step 1. Reflection can also proceed once
  // the planner has nothing left to ask (plannerDecision === null) and
  // the same hasEnoughDetail-based score shouldObserve uses is already
  // satisfied — without waiting out MIN_OBSERVATION_TURNS. Boolean
  // coverage alone is never enough here; this reuses shouldObserve's
  // own detail threshold, not coverage.xxx. This used to be an inline
  // boolean (plannerExhaustedWithDepth) computed right here; the same
  // two facts now go through decideDecisionGate() so the decision has
  // an explicit name and reason instead of an anonymous boolean.
  // gapMap/knowledge are passed in for visibility but do not change
  // this result this Sprint — see decisionGate.ts's module doc.
  const gateDecision = decideDecisionGate({
    plannerDecision,
    gapMap,
    knowledge: understandingUpdate.knowledge,
    coverageDetailScore: coverageDetailScore(understandingUpdate.next),
    coverageThreshold: COVERAGE_THRESHOLD,
    turnCount: hriState.turnCount,
  });
  devLog("DECISION GATE:", gateDecision);

  // 몸 상태(health) stop-readiness exception — audited separately
  // (turn3/turn4 실측: meaning이 유일하게 남은 슬롯일 때 강제로 채우게 하면
  // "그냥요"/"모르겠다"류 답변이 Reflection에 그대로 인용되어 품질이
  // 떨어지는 경우가 다수였고, presentState/emotion/wish만으로도 이미
  // COVERAGE_THRESHOLD를 충족하는 것으로 확인됨). decideNextSlot 자체는
  // 건드리지 않으므로 plannerDecision은 여전히 "meaning"을 가리키지만,
  // 몸 상태 + 남은 것이 meaning뿐 + 이미 충분한 깊이일 때만 그 질문을
  // 던지지 않고 Reflection으로 넘어간다. 다른 topic에는 적용되지 않는다.
  const healthMeaningStopReady =
    understandingUpdate.next.topic === "몸 상태" &&
    canReflect &&
    coverageDetailScore(understandingUpdate.next) >= COVERAGE_THRESHOLD &&
    plannerDecision?.slot === "meaning";

  if (canReflect && (coverageDone || convergence.converged || gateDecision.action === "reflect" || healthMeaningStopReady)) {
    const probe = selectProbe(hriState, new Set(hriState.usedQuestionIds));

    // Reflection reads Observation via ReflectionHint — conservatively
    // falls back to the previous turn's snapshot when this turn's own
    // plan is null/fallback (the common full-coverage case), and to a
    // no-op hint otherwise. composeReflection only reorders existing
    // lines with this; it never changes Understanding or wording.
    const reflectionHint = buildReflectionHint(observationSnapshot, previousObservationSnapshot);

    // Flow Summary + Observation 3단 구조.
    const flowSummary = "";
    const reflectionResult = composeReflection(understandingUpdate.next, reflectionHint);
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
      observationSnapshot,
    };

    return {
      state: nextState,
      events: [...withUserInput, createReflectionEvent(reflection)],
    };
  }

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

const baselineText =
  plannerDecision !== null
    ? selectQuestion(
        plannerDecision.slot,
        plannerDecision.anchor,
        usedSet,
      ).question
    : (
        NEUTRAL_DEEPENING.find((q) => !usedSet.has(q))
        ?? NEUTRAL_DEEPENING[hriState.turnCount % NEUTRAL_DEEPENING.length]
      );

  // --- Observation OS overlay (Beta, individual/organization only) ---
  // Reuses observationPlan computed above (shared with the Observation
  // Snapshot) instead of recomputing context/plan here. Auxiliary
  // role-repetition check only: never touches Understanding or
  // coverage, never overrides a null plannerDecision (that path stays
  // on NEUTRAL_DEEPENING exactly as before), and any failure applying
  // the alternate falls straight back to baselineText/plannerDecision.slot.
  let finalText = baselineText;
  let finalSlot = plannerDecision?.slot;

  if (plannerDecision !== null && observationPlan && !observationPlan.fallback && observationPlan.alternateSlot) {
    try {
      const altText = selectQuestion(observationPlan.alternateSlot, plannerDecision.anchor, usedSet).question;
      if (altText && altText !== baselineText) {
        finalText = altText;
        finalSlot = observationPlan.alternateSlot;
      }
    } catch {
      finalText = baselineText;
      finalSlot = plannerDecision?.slot;
    }
  }

  const question: QuestionOutput = {
    id: `v2-${probe.domain ?? "none"}-${probe.axis ?? "none"}-${hriState.turnCount}`,
    text: finalText,
    category: hriState.lastQuestionCategory ?? "density",
    aperture: "small",
    weight: 1,
  };
 devLog("QUESTION SOURCE:", question.id, question.text);
  const nextRecentSlots = finalSlot
    ? [...(hriState.recentSlots ?? []), finalSlot].slice(-2)
    : (hriState.recentSlots ?? []);
  const nextState: SessionStateV2 = {
    ...hriState,
    phase: "probing",
    pendingWhisper: false,
    lastQuestionCategory: question.category,
    usedQuestionIds: [...hriState.usedQuestionIds, question.text],
    // finalSlot is the slot the returned question.text actually asks about
    // (plannerDecision.slot unless the overlay swapped it) — using it here,
    // not plannerDecision?.slot, keeps probedFor() attribution correct on
    // the next turn when the overlay does swap.
    lastProbedSlot: finalSlot,
    recentSlots: nextRecentSlots,
    observationSnapshot,
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