import { runHriSession } from "./hri/sessionAdapter";
import { devLog } from "./devLog";
import type { Locale } from "./hri/locale";
import type { HriEvent, SessionState } from "./hri/types";

export type EngineRequest = {
  turn: number;
  inputs: string[];
  /** Development-only. When true, returns internal lane/compass diagnostics. */
  debug?: boolean;
  /** Multilingual Gate — the client sends the same value on every
   *  request for one session (locale is session-locked, chosen only
   *  before the first turn). Missing/unrecognized defaults to "ko"
   *  downstream in sessionAdapter.ts's resolveLocale — every caller
   *  that predates this Gate keeps identical Korean-only behavior. */
  locale?: Locale;
  /** State Continuation Gate — see sessionAdapter.ts's RuntimeRequest
   *  for the full contract. Optional and passed straight through. */
  priorState?: SessionState;
  priorEvents?: HriEvent[];
  /**
   * Question Observation Foundation Sprint 01 — client-generated
   * session id (already created in HriSession.tsx for the existing
   * /api/log call) and the question text the client had on screen
   * before this submission, i.e. what `inputs`'s last element is
   * answering. Both optional, both read only by api/analyze/route.ts
   * for Observation logging — getNextOutput/runHriSession/advanceSession
   * never read or forward either field, so this adds no new input to
   * the Engine itself.
   */
  sessionId?: string;
  previousQuestion?: string;
};

export type EngineResponse = {
  question?: string;
  reflection?: string;
  observation?: string;
  resonance?: boolean;
  mainQuestion?: string;
  mainQuestionLane?: string;
  mainQuestionConfidence?: number;
  stateCompass?: unknown;
  finished?: boolean;
  source?: string;
  /** State Continuation Gate — see sessionAdapter.ts's RuntimeResponse. */
  nextState?: SessionState;
  nextEvents?: HriEvent[];
};

export async function getNextOutput(request: EngineRequest): Promise<EngineResponse> {
  devLog("ENTRY: src/lib/questionEngine.ts getNextOutput");
  const turn = request.turn === 1 || request.turn === 2 || request.turn === 3 ? request.turn : 1;
  devLog("CALL: runHriSession");
  const response = await runHriSession({
    turn,
    inputs: Array.isArray(request.inputs) ? request.inputs : [],
    // Diagnostic fields are development-only regardless of what a
    // client requests — never exposed once NODE_ENV is "production".
    debug: request.debug === true && process.env.NODE_ENV !== "production",
    locale: request.locale,
    priorState: request.priorState,
    priorEvents: request.priorEvents,
  });

 return {
  ...response,
  finished: Boolean(response.reflection),
};
}

// Backward-compatible API/UI contract name.
export type EngineOutput = EngineResponse;