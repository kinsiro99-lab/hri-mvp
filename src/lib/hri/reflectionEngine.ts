import type { HriEvent, ReflectionOutput, SessionState } from "./types";
import { detectContextAnchors, extractUserInputs } from "./contextAnchors";
import type { ContextAnchorResult } from "./contextAnchors";
import { validateReflection } from "./validators";

function hasMeaningfulInput(events: HriEvent[] = []): boolean {
  return extractUserInputs(events).some((input) => input.replace(/\s+/g, "").length >= 3);
}

function positiveReflection(anchorResult: ContextAnchorResult): string {
  switch (anchorResult.positiveSignal) {
    case "joy":
      return "좋은 감정이 분명히 올라와 있고\n지금은 그 기쁨이 어디에서 시작되는지\n조용히 확인하는 흐름입니다.";
    case "calm":
      return "여유와 안정감이 중심에 있고\n지금은 그 상태를 키우기보다\n흐트러지지 않게 지키려는 흐름입니다.";
    case "hope":
      return "앞으로 이어질 기대가 보이고\n지금은 그 기대가 현실에서 어디에 닿는지\n확인하는 흐름입니다.";
    case "flow":
      return "일이 풀리는 감각이 올라와 있고\n지금은 그 흐름을 해치지 않는 조건을\n찾아가는 흐름입니다.";
    case "relief":
      return "가벼워진 감각이 올라와 있고\n지금은 무엇이 줄었을 때 편해지는지\n확인하는 흐름입니다.";
    default:
      return "좋은 흐름이 분명히 있고\n지금은 그 감정이 어디에서 시작되어\n어떻게 이어지는지를 확인하는 흐름입니다.";
  }
}

function mixedReflection(anchorResult: ContextAnchorResult): string {
  if (anchorResult.anchor === "launchPressure") {
    return "기쁜 일정이 현실로 가까워졌고\n지금은 그 기쁨을 잃지 않으면서\n준비 압박의 크기를 재는 흐름입니다.";
  }

  return "좋은 감정과 부담이 함께 올라와 있고\n지금은 어느 쪽이 방향을 잡는지\n먼저 구분하려는 흐름입니다.";
}

function pressuredReflection(anchorResult: ContextAnchorResult): string {
  switch (anchorResult.anchor) {
    case "reliefWish":
      return "지금의 흐름에서는 무언가를 더 하려는 마음보다\n먼저 덜어지고 가벼워지길 바라는 방향이\n선명하게 보입니다.";
    case "fatigue":
      return "몸이나 생각의 피로가 앞에 있고\n지금은 더 밀어붙이기보다\n어디에서 회복이 필요한지를 확인하는 흐름입니다.";
    case "workload":
      return "해야 할 일의 무게가 올라와 있고\n지금은 일의 양, 순서, 완성도 중\n무엇이 가장 부담인지 가르는 흐름입니다.";
    case "launchPressure":
      return "일정이 실제로 가까워지면서\n지금은 기대보다 준비 시간과 완성도에 대한 압박이\n더 선명해진 흐름으로 보입니다.";
    case "deadlinePressure":
      return "시간의 압박이 앞에 있고\n지금은 늦어지는 느낌이 어디에서 시작되는지\n확인하려는 흐름입니다.";
    case "uncertainty":
      return "아직 분명하지 않은 지점이 남아 있고\n지금은 그 불확실함이 무엇을 붙잡고 있는지\n확인하려는 흐름입니다.";
    case "delay":
      return "흐름이 늦어졌다는 감각이 있고\n지금은 다시 움직이기 위해\n어디를 먼저 풀어야 하는지 보는 흐름입니다.";
    case "body":
      return "몸의 감각이 먼저 신호를 보내고 있고\n지금은 그 신호가 피로인지 긴장인지\n확인하는 흐름입니다.";
    case "conflict":
      return "불편한 감정이 남아 있고\n지금은 그 감정이 어디에서 시작되었는지\n조심스럽게 확인하는 흐름입니다.";
    default:
      return "지금의 흐름 안에서 부담의 방향이 보이고\n무엇이 가장 크게 남아 있는지를\n차분히 확인하는 흐름입니다.";
  }
}

function composeReflection(events: HriEvent[] = []): string {
  if (!hasMeaningfulInput(events)) {
    return "아직은 마음의 방향을 단정하기보다\n지금 가장 먼저 떠오르는 느낌을\n천천히 확인하는 단계입니다.";
  }

  const anchorResult = detectContextAnchors(events);

  if (anchorResult.tone === "positive" || anchorResult.anchor === "positive") {
    return positiveReflection(anchorResult);
  }

  if (anchorResult.tone === "mixed") {
    return mixedReflection(anchorResult);
  }

  if (anchorResult.tone === "pressured") {
    return pressuredReflection(anchorResult);
  }

  return "지금 당신이 남긴 흐름 속에서\n가장 선명한 단서가 조용히 드러나고 있고\n그 방향을 조금 더 확인하는 단계입니다.";
}

export function createReflection(state: SessionState, events: HriEvent[] = []): ReflectionOutput {
  let text = composeReflection(events);

  if (!validateReflection(text)) {
    text = "지금 적힌 흐름은\n하나의 답보다\n아직 남아 있는 결에 가까워 보입니다.";
  }

  return {
    text,
    tone: state.emotionalDensity > 0.6 ? "dense" : "quiet",
    compressionLevel: "low",
  };
}

export const generateReflection = createReflection;
