import { advanceSession } from "./controller";
import { selectMainQuestionSeed, type MainQuestionLane } from "./mainQuestionEngine";
import { initialSessionState } from "./state";
import type { HriEvent, SessionState } from "./types";
import type { StateCompass } from "./stateCompass";

export type RuntimeTurn = 1 | 2 | 3;

export type RuntimeRequest = {
  turn: RuntimeTurn;
  inputs: string[];
  /** Development-only. Exposes internal routing information for local tests. */
  debug?: boolean;
};

export type RuntimeResponse = {
  question?: string;
  reflection?: string;
  mainQuestion?: string;
  mainQuestionLane?: MainQuestionLane;
  mainQuestionConfidence?: number;
  stateCompass?: StateCompass;
  source: "hri-runtime";
};

function cloneInitialState(): SessionState {
  return {
    ...initialSessionState,
    vectors: { ...initialSessionState.vectors },
    usedQuestionIds: [...initialSessionState.usedQuestionIds],
  };
}

function latestOutput(events: HriEvent[]): HriEvent | undefined {
  return [...events]
    .reverse()
    .find((event) => event.type === "question" || event.type === "reflection" || event.type === "safety");
}

export function runHriSession(request: RuntimeRequest): RuntimeResponse {
  const inputs = Array.isArray(request.inputs)
    ? request.inputs.map((value) => String(value ?? "").trim()).filter(Boolean).slice(0, 4)
    : [];

  let state = cloneInitialState();
  let events: HriEvent[] = [];

  for (const inputText of inputs) {
    const next = advanceSession({ inputText, state, events });
    state = next.state;
    events = next.events;
  }

  const output = latestOutput(events);

  if (!output) {
    return {
      question: "지금 가장 먼저 마음에 걸리는 지점은 무엇인가요?",
      source: "hri-runtime",
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
    };
  }

  if (output.type === "safety") {
    return {
      reflection: output.text,
      source: "hri-runtime",
    };
  }

  return {
    question: output.text,
    source: "hri-runtime",
  };
}
