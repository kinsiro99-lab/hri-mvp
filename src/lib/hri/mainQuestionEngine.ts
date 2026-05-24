import { analyzeStateCompass, type StateCompass } from "./stateCompass";
import {
  selectMainQuestionFromCompass,
  type MainQuestionLane,
  type MainQuestionSeed,
} from "./mainQuestionLayer";

export type { MainQuestionLane, MainQuestionSeed };
export type { StateCompass };

export interface SelectedMainQuestion extends MainQuestionSeed {
  stateCompass: StateCompass;
}

export function selectMainQuestionSeed(inputs: string[]): SelectedMainQuestion {
  const stateCompass = analyzeStateCompass(inputs);
  const seed = selectMainQuestionFromCompass(stateCompass, inputs);

  return {
    ...seed,
    stateCompass,
  };
}
