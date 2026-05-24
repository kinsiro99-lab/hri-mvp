import type { SessionState, WhisperOutput } from "./types";
import { validateWhisper } from "./validators";

export function createWhisper(state: SessionState): WhisperOutput | null {
  if (!state.pendingWhisper) return null;

  const text = state.exhaustion > 0.55
    ? "오늘은 한 문장 덜 밀어붙여도 충분할 수 있습니다."
    : "지금 흐름은 조금 더 천천히 이어가도 괜찮아 보입니다.";

  if (!validateWhisper(text)) return null;

  return {
    text,
    mode: state.exhaustion > 0.55 ? "reduction" : "continuation",
    delayMs: 15000,
    forceLevel: "low",
  };
}
