/**
 * HRI Flow Controller
 * 고정 Q1→Q2→Q3→Reflection 시퀀스를 동적 라우팅으로 대체한다.
 * 매 답변마다 라우팅 엔진에 다음 레이어를 묻고, 해당 레이어 콘텐츠를 공급한다.
 * 진단/해석/조언 없음.
 */

import routeDiscovery, {
  type NextLayer,
  type DiscoveryDepth,
  type DiscoverySignal,
} from './discoveryRoutingEngine';
import { pickContent } from './questionBank';

export interface FlowState {
  previousLayer: NextLayer | null;
  usedByLayer: Partial<Record<NextLayer, number[]>>;
  stepCount: number;
  holdCount: number;
  done: boolean;
}

export interface FlowStep {
  layer: NextLayer;
  kind: 'question' | 'mirror' | 'observation';
  content: string;
  depth: DiscoveryDepth;
  signal: DiscoverySignal;
  done: boolean;
}

const MAX_STEPS = 8;
const HOLD_LIMIT = 2;

export function createFlowState(): FlowState {
  return {
    previousLayer: null,
    usedByLayer: {},
    stepCount: 0,
    holdCount: 0,
    done: false,
  };
}

function kindForLayer(layer: NextLayer): FlowStep['kind'] {
  if (layer === 'MIRROR') return 'mirror';
  if (layer === 'OBSERVATION') return 'observation';
  return 'question';
}

function emit(
  layer: NextLayer,
  state: FlowState,
  depth: DiscoveryDepth,
  signal: DiscoverySignal,
): { step: FlowStep; state: FlowState } {
  const used = state.usedByLayer[layer] ?? [];
  const { content, index } = pickContent(layer, used);
  const done = layer === 'OBSERVATION';

  const nextState: FlowState = {
    previousLayer: layer,
    usedByLayer: { ...state.usedByLayer, [layer]: [...used, index] },
    stepCount: state.stepCount + 1,
    holdCount: state.holdCount,
    done,
  };

  const step: FlowStep = { layer, kind: kindForLayer(layer), content, depth, signal, done };
  return { step, state: nextState };
}

export function firstStep(state: FlowState = createFlowState()): { step: FlowStep; state: FlowState } {
  return emit('ASK_STRUCTURE', state, 'D0', 'DESCRIPTION_ONLY');
}

export function advanceFlow(answer: string, state: FlowState): { step: FlowStep; state: FlowState } {
  const { depth, signal, nextLayer } = routeDiscovery({
    answer,
    previousLayer: state.previousLayer ?? undefined,
  });
  const confusionMarkers = ['무슨 말', '무슨뜻', '무슨 뜻', '한박', '한 박', '아니다', '모르겠', '이해 안'];
  const isConfused = confusionMarkers.some((m) => answer.includes(m));
  const holdCount = signal === 'DESCRIPTION_ONLY' && !isConfused ? state.holdCount + 1 : 0;
 const carried: FlowState = { ...state, holdCount };

if (signal === 'RECOGNITION') {
  return emit('OBSERVATION', carried, depth, signal);
}
if (carried.stepCount >= 2) {
  return emit('OBSERVATION', carried, depth, signal);
}
  let layer: NextLayer = nextLayer;

    if (isConfused) {
    layer = 'ASK_STRUCTURE';
  } else if (signal === 'DESCRIPTION_ONLY' && holdCount >= HOLD_LIMIT) {
    layer = 'MIRROR';
  }

  if (carried.stepCount + 1 >= MAX_STEPS && layer !== 'OBSERVATION') {
    layer = layer === 'MIRROR' ? 'OBSERVATION' : 'MIRROR';
  }

  return emit(layer, carried, depth, signal);
}