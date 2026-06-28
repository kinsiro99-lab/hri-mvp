import type {
  SessionStateV2,
  ConvergenceParams,
  ConvergenceState,
  EvaluateConvergence,
  CurrentVector,
  DomainDistribution,
} from "./types.v2";
import { CONFIG_AXES, DOMAINS } from "./types.v2";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function configDelta(a: CurrentVector, b: CurrentVector): number {
  let sum = 0;
  for (const axis of CONFIG_AXES) {
    sum += Math.abs(a[axis] - b[axis]);
  }
  return sum;
}

function domainDelta(a: DomainDistribution, b: DomainDistribution): number {
  let sum = 0;
  for (const d of DOMAINS) {
    sum += Math.abs((a[d] ?? 0) - (b[d] ?? 0));
  }
  return sum;
}

function topAxisValue(v: CurrentVector): number {
  let max = 0;
  for (const axis of CONFIG_AXES) {
    if (v[axis] > max) max = v[axis];
  }
  return max;
}

export const evaluateConvergence: EvaluateConvergence = (
  state: SessionStateV2,
  params: ConvergenceParams,
): ConvergenceState => {
  const cfg = state.configHistory;
  const dom = state.domainHistory;
  const turn = state.turnCount;

  const n = cfg.length;
  const latestConfigDelta =
    n >= 2 ? configDelta(cfg[n - 1], cfg[n - 2]) : Number.POSITIVE_INFINITY;
  const latestDomainDelta =
    dom.length >= 2 ? domainDelta(dom[dom.length - 1], dom[dom.length - 2]) : Number.POSITIVE_INFINITY;

  const confidence = clamp01(1 - (Number.isFinite(latestConfigDelta) ? latestConfigDelta : 1));
  const top = n >= 1 ? topAxisValue(cfg[n - 1]) : 0;

  const base = {
    configDelta: Number.isFinite(latestConfigDelta) ? Number(latestConfigDelta.toFixed(3)) : 0,
    domainDelta: Number.isFinite(latestDomainDelta) ? Number(latestDomainDelta.toFixed(3)) : 0,
    confidence: Number(confidence.toFixed(3)),
  };

  if (turn >= params.hardCap) {
    return { ...base, converged: true, reason: "hard_cap" };
  }

  if (turn < params.minTurns) {
    return { ...base, converged: false, reason: "min_turns" };
  }

  if (n < params.stableTurnsRequired + 1) {
    return { ...base, converged: false, reason: "not_converged" };
  }

  if (top <= params.axisFloor) {
    return { ...base, converged: false, reason: "below_floor" };
  }

  let stable = true;
  for (let k = 0; k < params.stableTurnsRequired; k++) {
    const i = n - 1 - k;
    if (i - 1 < 0) { stable = false; break; }

    const cDelta = configDelta(cfg[i], cfg[i - 1]);
    const dHasPair = dom.length > i && i - 1 >= 0;
    const dDelta = dHasPair ? domainDelta(dom[i], dom[i - 1]) : Number.POSITIVE_INFINITY;

    if (cDelta >= params.epsilonConfig || dDelta >= params.epsilonDomain) {
      stable = false;
      break;
    }
  }

  if (stable) {
    return { ...base, converged: true, reason: "config_stable" };
  }

  return { ...base, converged: false, reason: "not_converged" };
};

export default evaluateConvergence;