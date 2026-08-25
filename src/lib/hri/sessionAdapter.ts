import { advanceSession } from "./controller";
import { selectMainQuestionSeed, type MainQuestionLane } from "./mainQuestionEngine";
import { initialSessionState } from "./state";
import type { HriEvent, SessionState } from "./types";
import type { StateCompass } from "./stateCompass";
import { resolveLocale, type Locale } from "./locale";

export type RuntimeTurn = 1 | 2 | 3;

export type RuntimeRequest = {
  turn: RuntimeTurn;
  inputs: string[];
  /** Development-only. Exposes internal routing information for local tests. */
  debug?: boolean;
  /** Multilingual Gate — resolved once here (defaults to "ko" if
   *  missing/unrecognized) and passed unchanged into every advanceSession
   *  call in the replay loop below, so one session never mixes locales
   *  turn-to-turn (Beta Handoff §2: locale is session-locked). */
  locale?: Locale;
  /**
   * State Continuation Gate — when the caller already holds the
   * SessionState/HriEvent[] this same session produced last turn (see
   * nextState/nextEvents on RuntimeResponse below), pass them back here
   * so this call advances exactly one new turn instead of replaying
   * the whole conversation from scratch (see the branch in
   * runHriSession below). `inputs` is still read in this mode — only
   * its LAST element (the newest turn's text) is used; earlier
   * elements are ignored since priorState/priorEvents already carry
   * their effect. Omit both (or on turn 1) to use the original
   * full-replay path, preserved below unchanged.
   */
  priorState?: SessionState;
  priorEvents?: HriEvent[];
};

export type RuntimeResponse = {
  question?: string;
  reflection?: string;
  mainQuestion?: string;
  mainQuestionLane?: MainQuestionLane;
  mainQuestionConfidence?: number;
  stateCompass?: StateCompass;
  source: "hri-runtime";
  /**
   * State Continuation Gate — the SessionState/HriEvent[] this turn
   * actually produced. The caller stores these (session memory only)
   * and sends them back as priorState/priorEvents on the next turn.
   */
  nextState?: SessionState;
  nextEvents?: HriEvent[];
};

function cloneInitialState(): SessionState {
  return {
    ...initialSessionState,
    vectors: { ...initialSessionState.vectors },
    usedQuestionIds: [...initialSessionState.usedQuestionIds],
  };
}

type OutputEvent = Extract<HriEvent, { type: "question" | "reflection" | "safety" }>;

function latestOutput(events: HriEvent[]): OutputEvent | undefined {
  return [...events]
    .reverse()
    .find(
      (event): event is OutputEvent =>
        event.type === "question" || event.type === "reflection" || event.type === "safety",
    );
}
/**
 * 한 세션에서 재생할 최대 입력 수.
 * 이 어댑터는 매 요청마다 전체 입력을 처음부터 재생해 상태를 복원하므로,
 * 이 값보다 뒤의 입력은 엔진에 도달하지 않는다.
 * 현재 종료 조건에 여유를 두되 무제한 입력은 허용하지 않는다.
 */
const MAX_SESSION_INPUTS = 12;

export async function runHriSession(request: RuntimeRequest): Promise<RuntimeResponse> {
  const inputs = Array.isArray(request.inputs)
    ? request.inputs
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .slice(0, MAX_SESSION_INPUTS)
    : [];
  const locale = resolveLocale(request.locale);

  let state: SessionState;
  let events: HriEvent[];

  // State Continuation Gate — advance exactly the one new turn on top
  // of the caller's already-confirmed state, instead of replaying
  // every prior turn's advanceSession (and therefore every prior
  // turn's LLM calls) again on every single request. advanceSession
  // itself never changes — it already only ever took one
  // {inputText, state, events} at a time; only this adapter's own loop
  // was forcing a from-scratch replay. Falls back to the untouched
  // full-replay path below whenever priorState/priorEvents is missing
  // (turn 1, or any caller that predates this Gate).
  if (request.priorState && request.priorEvents && inputs.length > 0) {
    const newInputText = inputs[inputs.length - 1];
    const next = await advanceSession({ inputText: newInputText, state: request.priorState, events: request.priorEvents, locale });
    state = next.state;
    events = next.events;
  } else {
    // Full-history replay path — preserved unchanged as the fallback
    // for turn 1 (no prior state exists yet) and for any caller that
    // does not send priorState/priorEvents.
    state = cloneInitialState();
    events = [];

    for (const inputText of inputs) {
      const next = await advanceSession({ inputText, state, events, locale });
      state = next.state;
      events = next.events;
    }
  }

  const output = latestOutput(events);

  if (!output) {
    return {
      question: locale === "ja" ? "今、一番心に引っかかっていることは何ですか？" : "지금 가장 먼저 마음에 걸리는 지점은 무엇인가요?",
      source: "hri-runtime",
      nextState: state,
      nextEvents: events,
    };
  }

  if (output.type === "reflection") {
    const seed = selectMainQuestionSeed(inputs);

    return {
      reflection: output.text,
      mainQuestion: seed.question,
      ...(request.debug
        ? {
            mainQuestionLane: seed.lane,
            mainQuestionConfidence: seed.confidence,
            stateCompass: seed.stateCompass,
          }
        : {}),
      source: "hri-runtime",
      nextState: state,
      nextEvents: events,
    };
  }

  if (output.type === "safety") {
    return {
      reflection: output.text,
      source: "hri-runtime",
      nextState: state,
      nextEvents: events,
    };
  }

  return {
    question: output.text,
    source: "hri-runtime",
    nextState: state,
    nextEvents: events,
  };
}
