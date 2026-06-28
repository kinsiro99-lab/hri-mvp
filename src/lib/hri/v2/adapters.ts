import type { RhythmSignal } from "../types";
import type { CurrentVector } from "./types.v2";

function n(v: number | undefined): number {
  return Math.max(0, Math.min(1, v ?? 0));
}

export function toCurrentVector(signal: RhythmSignal): CurrentVector {
  const v = signal.vectors ?? {};
  const pv = n(signal.positiveValence);

  return {
    collapse: n(v.collapse),
    pressure: n(v.pressure),
    fragmentation: n(v.fragmentation),
    looping: n(v.looping),
    avoidance: n(v.avoidance),
    numbness: n(v.numbness),
    selfBlame: n(v.selfBlame),
    inwardMotion: n(v.inwardMotion),
    outwardMotion: n(v.outwardMotion),
    achievement: pv,
    momentum: pv,
    vitality: pv,
    expansion: n(pv * 0.6),
    connection: n(pv * 0.6),
    relief: n(pv * 0.6),
  };
}

export function emptyCurrentVector(): CurrentVector {
  return {
    collapse: 0, pressure: 0, fragmentation: 0, looping: 0, avoidance: 0,
    numbness: 0, selfBlame: 0, inwardMotion: 0, outwardMotion: 0,
    achievement: 0, momentum: 0, expansion: 0, vitality: 0, connection: 0, relief: 0,
  };
}