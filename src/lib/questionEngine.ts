import { runHriSession } from "./hri/sessionAdapter";

export type EngineRequest = {
  turn: number;
  inputs: string[];
  /** Development-only. When true, returns internal lane/compass diagnostics. */
  debug?: boolean;
};

export type EngineResponse = {
  question?: string;
  reflection?: string;
  mainQuestion?: string;
  mainQuestionLane?: string;
  mainQuestionConfidence?: number;
  stateCompass?: unknown;
  finished?: boolean;
  source?: string;
};

export function getNextOutput(request: EngineRequest): EngineResponse {
  const turn = request.turn === 1 || request.turn === 2 || request.turn === 3 ? request.turn : 1;
  const response = runHriSession({
    turn,
    inputs: Array.isArray(request.inputs) ? request.inputs : [],
    debug: request.debug === true,
  });

  return {
    ...response,
    finished: Boolean(response.reflection),
  };
}


// Backward-compatible API/UI contract n ame.
export type EngineOutput = EngineResponse
