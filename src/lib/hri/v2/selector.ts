import type { SelectQuestion, Slot } from "./types.v2";
import { SLOT_QUESTIONS } from "./slotQuestions";
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
    axis !== null ? tree.byAxis[axis as keyof typeof tree.byAxis] ?? tree.default : tree.default;

  const question =
    pickUnused(branch, used) ??
    pickUnused(tree.default, used) ??
    tree.default[0];

  return { domain, axis, question };
};

export default selectProbe;
/* =========================================================
 * selectQuestion (V2 live path) — ADD ONLY
 *
 * Planner가 결정한 slot 안에서만 문장을 고른다.
 * 방향(slot)을 다시 결정하지 않으며 domains/axis를 보지 않는다.
 * anchor가 있으면 anchored 문형에 삽입하고,
 * 없거나 부적절하면 neutral 문형으로 폴백한다.
 * 기존 selectProbe는 그대로 유지한다.
 * ========================================================= */

const ANCHOR_TOKEN = "{anchor}";

function isUsableAnchor(anchor: string | undefined): anchor is string {
  if (!anchor) return false;

  const trimmed = anchor.trim();

  if (trimmed.length === 0) return false;
  if (trimmed.length > 20) return false;

  // Reject multi-word text ending in a typical Korean sentence-final
  // syllable (해요체 "-요" / 평서형 "-다") — a strong signal this is a
  // full clause (e.g. "그냥 사소한 걸로 다퉜어요"), not a short noun-like
  // concept, which breaks grammar when inserted into "그 '{anchor}'..."
  // templates. Single-word anchors are never affected by this check.
  if (/\s/.test(trimmed) && /[요다]$/.test(trimmed)) return false;

  return true;
}

function fillAnchor(template: string, anchor: string): string {
  return template.split(ANCHOR_TOKEN).join(anchor);
}

export const selectQuestion: SelectQuestion = (
  slot: Slot,
  anchor: string | undefined,
  used: ReadonlySet<string>,
) => {
  const pool = SLOT_QUESTIONS[slot];

  if (isUsableAnchor(anchor)) {
    const filled = pool.anchored.map((template) =>
      fillAnchor(template, anchor),
    );

    const picked = pickUnused(filled, used);

    if (picked !== null) {
      return { question: picked };
    }
  }

  const neutralPicked = pickUnused(pool.neutral, used);

  if (neutralPicked !== null) {
    return { question: neutralPicked };
  }

  return { question: pool.neutral[0] };
};