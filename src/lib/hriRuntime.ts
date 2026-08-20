import { runHriSession } from "./hri/sessionAdapter";
import { devLog } from "./devLog";
import type { Locale } from "./hri/locale";

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
  });

 return {
  ...response,
  finished: Boolean(response.reflection),
};
}

// Backward-compatible API/UI contract name.
export type EngineOutput = EngineResponse;