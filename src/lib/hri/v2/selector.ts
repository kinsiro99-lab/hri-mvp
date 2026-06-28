import type {
  SessionStateV2,
  SelectProbe,
  Domain,
  ConfigAxisKey,
  CurrentVector,
  QuestionTree,
} from "./types.v2";
import { dominantDomain } from "./types.v2";
import { QUESTION_INDEX } from "./questionIndex";

export const SELECTOR_SALIENT_FLOOR = 0.2;

export function mostUncertainSalientAxis(
  vector: CurrentVector,
  candidateAxes: readonly ConfigAxisKey[],
  floor: number = SELECTOR_SALIENT_FLOOR,
): ConfigAxisKey | null {
  let best: ConfigAxisKey | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const axis of candidateAxes) {
    const v = vector[axis];
    if (v < floor) continue;
    const distance = Math.abs(v - 0.5);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = axis;
    }
  }

  return best;
}

function axesOfTree(tree: QuestionTree): ConfigAxisKey[] {
  return Object.keys(tree.byAxis) as ConfigAxisKey[];
}

function pickUnused(pool: readonly string[], used: ReadonlySet<string>): string | null {
  if (pool.length === 0) return null;
  for (const q of pool) {
    if (!used.has(q)) return q;
  }
  return pool[0];
}

const NEUTRAL_OPENING: readonly string[] = [
  "지금 가장 먼저 떠오르는 것은 무엇인가요?",
  "지금 마음에 가장 오래 머무는 것은 무엇인가요?",
];

export const selectProbe: SelectProbe = (
  state: SessionStateV2,
  used: ReadonlySet<string>,
) => {
  const domain: Domain | null = dominantDomain(state.domains);

  if (domain === null) {
    return {
      domain: null,
      axis: null,
      question: pickUnused(NEUTRAL_OPENING, used) ?? NEUTRAL_OPENING[0],
    };
  }

  const tree = QUESTION_INDEX[domain];
  const candidateAxes = axesOfTree(tree);

  const axis = mostUncertainSalientAxis(state.currentVector, candidateAxes);

  const branch =
    axis !== null ? tree.byAxis[axis] ?? tree.default : tree.default;

  const question =
    pickUnused(branch, used) ??
    pickUnused(tree.default, used) ??
    tree.default[0];

  return { domain, axis, question };
};

export default selectProbe;