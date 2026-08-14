import { runHriSession } from "./hri/sessionAdapter";
import { devLog } from "./devLog";

export type EngineRequest = {
  turn: number;
  inputs: string[];
  /** Development-only. When true, returns internal lane/compass diagnostics. */
  debug?: boolean;
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

export function getNextOutput(request: EngineRequest): EngineResponse {
  devLog("ENTRY: src/lib/questionEngine.ts getNextOutput");
  const turn = request.turn === 1 || request.turn === 2 || request.turn === 3 ? request.turn : 1;
  devLog("CALL: runHriSession");
  const response = runHriSession({
    turn,
    inputs: Array.isArray(request.inputs) ? request.inputs : [],
    // Diagnostic fields are development-only regardless of what a
    // client requests — never exposed once NODE_ENV is "production".
    debug: request.debug === true && process.env.NODE_ENV !== "production",
  });

 return {
  ...response,
  finished: Boolean(response.reflection),
};
}

// Backward-compatible API/UI contract name.
export type EngineOutput = EngineResponse;