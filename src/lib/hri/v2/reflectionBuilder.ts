import type { UnderstandingState } from "./understandingEngine";
import { VOICE_GUIDE } from "./voiceGuide";

export interface ReflectionResult {
  title: string;
  body: string;
  closing: string;
}

export function buildReflection(state: UnderstandingState): ReflectionResult {
  void VOICE_GUIDE;

  switch (state.topic) {
    case "관계":
      return buildRelationshipReflection(state);

    case "업무 압박":
      return buildWorkReflection(state);

    case "기억":
      return buildMemoryReflection(state);

    case "몸 상태":
      return buildHealthReflection(state);

    default:
      return buildDefaultReflection(state);
  }
}

function buildRelationshipReflection(state: UnderstandingState): ReflectionResult {
  const body = compact([
    state.relationship
      ? `한 사람과의 연결은 ${state.relationship}의 형태로 마음에 남아 있는 것으로 보입니다.`
      : `한 사람과의 흐름이 아직 마음 안에 남아 있는 것으로 보입니다.`,

    state.presentState
      ? `그 관계는 지금 ${state.presentState}로 이어지고 있습니다.`
      : undefined,

    state.emotion
      ? `그 안에는 ${state.emotion}도 함께 남아 있는 것으로 보입니다.`
      : undefined,

    state.wish
      ? `${state.wish}라는 표현은, 그 흐름이 아직 완전히 닫히지 않았음을 보여줍니다.`
      : undefined,

    state.meaning
      ? `${state.meaning}이라는 말도 이 관계의 흐름 안에 함께 놓여 있습니다.`
      : undefined,
  ]);

  return {
    title: "현재의 관계 흐름",
    body,
    closing:
      "지금은 그 관계를 판단하기보다, 마음에 남아 있는 흐름을 조용히 바라볼 수 있는 지점에 가까워 보입니다.",
  };
}

function buildWorkReflection(state: UnderstandingState): ReflectionResult {
  const body = compact([
    `현재의 흐름은 업무를 중심으로 이어지고 있는 것으로 보입니다.`,

    state.presentState
      ? `${state.presentState}가 지금의 업무 흐름 안에 놓여 있습니다.`
      : undefined,

    state.emotion
      ? `그 과정에서 ${state.emotion}도 함께 남아 있는 것으로 보입니다.`
      : undefined,

    state.target
      ? `${state.target} 자체보다, 그 일이 만들어낸 흐름이 더 선명하게 드러나고 있습니다.`
      : undefined,

    state.wish
      ? `${state.wish}라는 마음도 이 흐름 안에서 함께 나타납니다.`
      : undefined,

    state.meaning
      ? `${state.meaning}이라는 표현도 지금의 업무 흐름에 함께 남아 있습니다.`
      : undefined,
  ]);

  return {
    title: "현재의 업무 흐름",
    body,
    closing:
      "지금은 해결을 서두르기보다, 현재의 부담과 막힘을 먼저 분명히 바라보는 단계에 가까워 보입니다.",
  };
}

function buildMemoryReflection(state: UnderstandingState): ReflectionResult {
  const body = compact([
    `현재의 흐름은 하나의 기억을 중심으로 이어지고 있는 것으로 보입니다.`,

    state.target
      ? `${state.target}이 그 기억 안에서 가장 선명하게 떠오르고 있습니다.`
      : undefined,

    state.emotion
      ? `그 기억에는 ${state.emotion}도 함께 남아 있는 것으로 보입니다.`
      : undefined,

    state.presentState
      ? `그 기억은 지금 ${state.presentState}로 남아 있습니다.`
      : undefined,

    state.wish
      ? `${state.wish}라는 마음도 그 기억의 흐름 안에 함께 놓여 있습니다.`
      : undefined,

    state.meaning
      ? `${state.meaning}이라는 표현도 그 기억이 남긴 흐름 안에 있습니다.`
      : undefined,
  ]);

  return {
    title: "현재의 기억 흐름",
    body,
    closing:
      "지금은 그 기억을 결론짓기보다, 마음에 남아 있는 장면을 천천히 바라볼 수 있는 지점에 가까워 보입니다.",
  };
}

function buildHealthReflection(state: UnderstandingState): ReflectionResult {
  const body = compact([
    `현재의 흐름은 몸 상태를 중심으로 이어지고 있는 것으로 보입니다.`,

    state.target
      ? `${state.target}이 지금 가장 선명하게 느껴지는 부분으로 드러납니다.`
      : undefined,

    state.presentState
      ? `현재는 ${state.presentState}로 이어지고 있는 것으로 보입니다.`
      : undefined,

    state.emotion
      ? `그 상태와 함께 ${state.emotion}도 남아 있는 모습입니다.`
      : undefined,

    state.wish
      ? `${state.wish}라는 마음도 이 흐름 안에 함께 나타납니다.`
      : undefined,

    state.meaning
      ? `${state.meaning}이라는 표현도 현재 상태의 흐름 안에 함께 놓여 있습니다.`
      : undefined,
  ]);

  return {
    title: "현재의 몸 상태",
    body,
    closing:
      "지금은 상태를 단정하기보다, 몸과 마음이 보내는 흐름을 조심스럽게 바라보는 단계에 가까워 보입니다.",
  };
}

function buildDefaultReflection(state: UnderstandingState): ReflectionResult {
  const body = compact([
    state.topic
      ? `${state.topic}이 현재 흐름의 중심에 놓여 있는 것으로 보입니다.`
      : `아직 하나의 방향으로 정리되기보다, 떠오른 것을 조심스럽게 확인하는 흐름에 가깝습니다.`,

    state.target
      ? `${state.target}이 그 흐름 안에서 선명하게 드러납니다.`
      : undefined,

    state.presentState
      ? `${state.presentState}가 현재의 흐름 안에 놓여 있습니다.`
      : undefined,

    state.emotion
      ? `${state.emotion}이 그 흐름 안에 남아 있는 것으로 보입니다.`
      : undefined,

    state.wish
      ? `${state.wish}라는 마음도 함께 드러납니다.`
      : undefined,

    state.meaning
      ? `${state.meaning}이라는 표현도 함께 남아 있습니다.`
      : undefined,
  ]);

  return {
    title: "현재의 흐름",
    body,
    closing:
      "지금은 이 흐름을 조금 더 차분히 바라볼 수 있는 지점에 가까워 보입니다.",
  };
}

function compact(lines: Array<string | undefined>): string {
  return lines.filter(Boolean).join("\n\n");
}