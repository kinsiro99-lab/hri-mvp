import type {
  SessionStateV2,
  DomainSignal,
  DomainDistribution,
  CurrentVector,
} from "./types.v2";
import { DOMAINS, CONFIG_AXES, DOMAIN_BLEND_WEIGHT } from "./types.v2";

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, Number(x.toFixed(3))));
}

function blend(prev: number, next: number, w: number): number {
  return clamp01(prev * (1 - w) + next * w);
}

const CONFIG_BLEND_WEIGHT = 0.35;

function blendDomains(prev: DomainDistribution, signal: DomainDistribution): DomainDistribution {
  const out: DomainDistribution = {};
  for (const d of DOMAINS) {
    const blended = blend(prev[d] ?? 0, signal[d] ?? 0, DOMAIN_BLEND_WEIGHT);
    if (blended > 0) out[d] = blended;
  }
  return out;
}

function blendVector(prev: CurrentVector, signal: CurrentVector): CurrentVector {
  const out = {} as CurrentVector;
  for (const axis of CONFIG_AXES) {
    out[axis] = blend(prev[axis], signal[axis], CONFIG_BLEND_WEIGHT);
  }
  return out;
}

export function reduceSessionStateV2(
  base: SessionStateV2,
  domainSignal: DomainSignal,
  vectorSignal: CurrentVector,
): SessionStateV2 {
  const domains = blendDomains(base.domains, domainSignal.distribution);
  const currentVector = blendVector(base.currentVector, vectorSignal);

  return {
    ...base,
    domains,
    currentVector,
    domainHistory: [...base.domainHistory, domains],
    configHistory: [...base.configHistory, currentVector],
  };
}

export default reduceSessionStateV2;