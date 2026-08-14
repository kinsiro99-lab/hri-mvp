import type { UnderstandingState } from "./understandingEngine";
import { VOICE_GUIDE } from "./voiceGuide";
import type { ReflectionHint } from "./reflectionHint";
import type { ObservationGoal } from "./observationGoals";
import { resolveReflectionTitle } from "./reflectionTitle";

export interface ReflectionResult {
  title: string;
  body: string;
  closing: string;
}

/**
 * Step 5 addition — ordering only, see emphasize()/GOAL_EMPHASIS_FIELDS
 * below. No line text, template, or topic-dispatch logic here changes.
 */
export function composeReflection(
  state: UnderstandingState,
  hint?: ReflectionHint,
): ReflectionResult {
  void VOICE_GUIDE;

  switch (state.topic) {
    case "관계":
      return composeRelationshipReflection(state, hint);

    case "업무 압박":
      return composeWorkReflection(state, hint);

    case "기억":
      return composeMemoryReflection(state, hint);

    case "몸 상태":
      return composeHealthReflection(state, hint);

    default:
      return composeDefaultReflection(state, hint);
  }
}

/* =========================================================
 * Emphasis ordering (Step 5) — ADD ONLY.
 *
 * Reorders the same candidate lines each composer already builds;
 * never adds, removes, rewrites, or paraphrases a line. Moves at most
 * one matching semantic line to the front, preserving the relative
 * order of everything else. If hint is missing/fallback/has no goal,
 * or no candidate field for that goal has a non-empty line, the input
 * array is returned unchanged — output stays byte-identical to today.
 * ========================================================= */

type SemanticField = "topic" | "target" | "presentState" | "emotion" | "relationship" | "wish" | "meaning";

/**
 * BETA_BRIDGE: GOAL_EMPHASIS_FIELDS
 *
 * ObservationGoal (observationGoals.ts) and UnderstandingState's
 * semantic fields (understandingEngine.ts) are two independently-
 * designed type systems with no natural correspondence — this
 * hand-authored table is the bridge, not a permanent semantic
 * equivalence. See "Beta Bridges" in docs/ObservationOS.md for why it
 * exists, its known limitations, and its exact removal condition.
 *
 * Suggested emphasis per Goal (WHY → which existing line to lead with),
 * in priority order — emphasize() below uses the first entry that has
 * a non-empty line. "prioritize" is the sharpest instance of this
 * bridge: no dedicated priority field exists in UnderstandingState, so
 * meaning/presentState are the closest existing semantic carriers.
 * "connect"/"expand" are not reachable from any individual/organization
 * transition today (see observationGoals.ts), kept here only for
 * exhaustiveness. "relationship" has no standalone line index in any
 * composer below (it's folded into the same slot as "target" in
 * composeRelationshipReflection), so a "connect" hint will, in
 * practice, fall through to its "emotion" candidate.
 */
const GOAL_EMPHASIS_FIELDS: Record<ObservationGoal, readonly SemanticField[]> = {
  identify: ["presentState", "emotion"],
  stabilize: ["presentState", "emotion"],
  connect: ["relationship", "emotion"],
  interpret: ["meaning"],
  prioritize: ["meaning", "presentState"],
  integrate: ["wish"],
  reorient: ["wish"],
  expand: [],
};

/**
 * Moves the first candidate field (in priority order) that has a
 * non-empty line to the front of `lines`, leaving every other line's
 * relative order untouched. `fieldTags[i]` names the semantic field
 * `lines[i]` was built from. Returns `lines` unchanged if no candidate
 * matches a non-empty line, or if `hint` doesn't apply.
 */
function emphasize(
  lines: ReadonlyArray<string | undefined>,
  fieldTags: readonly SemanticField[],
  hint: ReflectionHint | undefined,
): ReadonlyArray<string | undefined> {
  if (!hint || hint.fallback || !hint.goal) return lines;

  const candidates = GOAL_EMPHASIS_FIELDS[hint.goal];

  for (const field of candidates) {
    const index = fieldTags.indexOf(field);
    if (index === -1) continue;
    if (!lines[index]) continue;

    const reordered = [...lines];
    const [moved] = reordered.splice(index, 1);
    reordered.unshift(moved);
    return reordered;
  }

  return lines;
}

function composeRelationshipReflection(
  state: UnderstandingState,
  hint?: ReflectionHint,
): ReflectionResult {
  const lines: Array<string | undefined> = [
    state.target
      ? `지금 관계의 흐름에서 가장 선명하게 떠오른 것은 '${clean(state.target)}'입니다.`
      : state.relationship
        ? `마음에는 '${clean(state.relationship)}'의 형태로 이어진 관계가 남아 있습니다.`
        : "한 사람과의 연결이 아직 마음 안에 남아 있습니다.",

    state.presentState
      ? `그 관계의 현재 상태는 '${clean(state.presentState)}'라는 말로 나타납니다.`
      : undefined,

    state.emotion
      ? `그 안에는 '${clean(state.emotion)}'이라는 감정도 함께 머물고 있습니다.`
      : undefined,

    state.wish
      ? `마음은 그 관계에서 '${clean(state.wish)}'이라는 바람을 향하고 있습니다.`
      : undefined,

    state.meaning
      ? `그 흐름에는 '${clean(state.meaning)}'이라는 의미도 함께 남아 있습니다.`
      : undefined,
  ];
  const fieldTags: SemanticField[] = ["target", "presentState", "emotion", "wish", "meaning"];
  const body = compactUnique(emphasize(lines, fieldTags, hint));

  return {
    title: resolveReflectionTitle(state, hint),
    body,
    closing:
      "지금은 그 관계를 판단하기보다, 마음에 남아 있는 연결과 바람을 조용히 바라보는 지점에 가까워 보입니다.",
  };
}

function composeWorkReflection(
  state: UnderstandingState,
  hint?: ReflectionHint,
): ReflectionResult {
  const lines: Array<string | undefined> = [
    state.target
      ? `현재 업무 흐름에서 가장 선명하게 드러난 것은 '${clean(state.target)}'입니다.`
      : "현재의 흐름은 업무를 중심으로 이어지고 있습니다.",

    state.presentState
      ? `지금의 업무 상태는 '${clean(state.presentState)}'라는 말로 나타납니다.`
      : undefined,

    state.emotion
      ? `그 과정에는 '${clean(state.emotion)}'이라는 감정도 함께 남아 있습니다.`
      : undefined,

    state.wish
      ? `마음은 그 상황에서 '${clean(state.wish)}'이라는 바람을 향하고 있습니다.`
      : undefined,

    state.meaning
      ? `그 흐름에는 '${clean(state.meaning)}'이라는 의미도 함께 놓여 있습니다.`
      : undefined,
  ];
  const fieldTags: SemanticField[] = ["target", "presentState", "emotion", "wish", "meaning"];
  const body = compactUnique(emphasize(lines, fieldTags, hint));

  return {
    title: resolveReflectionTitle(state, hint),
    body,
    closing:
      "지금은 해결을 서두르기보다, 현재의 상태와 마음이 향하는 곳을 먼저 바라보는 단계에 가까워 보입니다.",
  };
}

function composeMemoryReflection(
  state: UnderstandingState,
  hint?: ReflectionHint,
): ReflectionResult {
  const lines: Array<string | undefined> = [
    state.target
      ? `지금 가장 선명하게 떠오른 것은 '${clean(state.target)}'입니다.`
      : "현재의 마음은 하나의 기억을 중심으로 이어지고 있습니다.",

    state.presentState
      ? `그 기억의 현재 모습은 '${clean(state.presentState)}'라는 말로 나타납니다.`
      : undefined,

    state.emotion
      ? `그 장면과 함께 '${clean(state.emotion)}'이라는 감정도 이어지고 있습니다.`
      : undefined,

    state.wish
      ? `마음은 그 기억을 따라 '${clean(state.wish)}'이라는 바람으로 움직이고 있습니다.`
      : undefined,

    state.meaning
      ? `그 안에는 '${clean(state.meaning)}'이라는 의미도 함께 머물고 있습니다.`
      : undefined,
  ];
  const fieldTags: SemanticField[] = ["target", "presentState", "emotion", "wish", "meaning"];
  const body = compactUnique(emphasize(lines, fieldTags, hint));

  return {
    title: resolveReflectionTitle(state, hint),
    body,
    closing:
      "지금은 그 기억을 결론짓기보다, 그 안에 남아 있는 감정과 바람을 천천히 바라보는 지점에 가까워 보입니다.",
  };
}

function composeHealthReflection(
  state: UnderstandingState,
  hint?: ReflectionHint,
): ReflectionResult {
  const lines: Array<string | undefined> = [
    state.target
      ? `지금 몸 상태에서 가장 선명하게 느껴지는 것은 '${clean(state.target)}'입니다.`
      : "현재의 흐름은 몸 상태를 중심으로 이어지고 있습니다.",

    state.presentState
      ? `현재 상태는 '${clean(state.presentState)}'라는 말로 나타납니다.`
      : undefined,

    state.emotion
      ? `그 상태와 함께 '${clean(state.emotion)}'이라는 감정도 남아 있습니다.`
      : undefined,

    state.wish
      ? `마음은 그 안에서 '${clean(state.wish)}'이라는 바람을 향하고 있습니다.`
      : undefined,

    state.meaning
      ? `이 흐름에는 '${clean(state.meaning)}'이라는 의미도 함께 놓여 있습니다.`
      : undefined,
  ];
  const fieldTags: SemanticField[] = ["target", "presentState", "emotion", "wish", "meaning"];
  const body = compactUnique(emphasize(lines, fieldTags, hint));

  return {
    title: resolveReflectionTitle(state, hint),
    body,
    closing:
      "지금은 상태를 단정하기보다, 몸과 마음에 나타난 흐름을 조심스럽게 바라보는 단계에 가까워 보입니다.",
  };
}

function composeDefaultReflection(
  state: UnderstandingState,
  hint?: ReflectionHint,
): ReflectionResult {
  const lines: Array<string | undefined> = [
    state.topic
      ? `현재 마음의 흐름은 '${clean(state.topic)}'을 중심으로 이어지고 있습니다.`
      : "아직 하나의 방향으로 정리되기보다, 떠오른 것을 조심스럽게 확인하는 흐름에 가깝습니다.",

    state.target
      ? `그 안에서 가장 선명하게 드러난 것은 '${clean(state.target)}'입니다.`
      : undefined,

    state.presentState
      ? `현재 상태는 '${clean(state.presentState)}'라는 말로 나타납니다.`
      : undefined,

    state.emotion
      ? `그 흐름에는 '${clean(state.emotion)}'이라는 감정도 함께 남아 있습니다.`
      : undefined,

    state.wish
      ? `마음은 그 안에서 '${clean(state.wish)}'이라는 바람을 향하고 있습니다.`
      : undefined,

    state.meaning
      ? `또한 '${clean(state.meaning)}'이라는 의미도 함께 놓여 있습니다.`
      : undefined,
  ];
  const fieldTags: SemanticField[] = ["topic", "target", "presentState", "emotion", "wish", "meaning"];
  const body = compactUnique(emphasize(lines, fieldTags, hint));

  return {
    title: resolveReflectionTitle(state, hint),
    body,
    closing:
      "지금은 이 흐름을 판단하기보다, 마음에 나타난 상태와 바람을 차분히 바라보는 지점에 가까워 보입니다.",
  };
}

function compactUnique(
  lines: ReadonlyArray<string | undefined>,
): string {
  const result: string[] = [];
  const used = new Set<string>();

  for (const line of lines) {
    if (!line?.trim()) {
      continue;
    }

    const normalized = line.trim();
    const key = canonicalize(normalized);

    if (used.has(key)) {
      continue;
    }

    used.add(key);
    result.push(normalized);
  }

  return result.join("\n\n");
}

function clean(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "")
    .replace(/[.!?。！？]+$/g, "")
    .trim();
}

function canonicalize(value: string): string {
  return value
    .replace(/[.!?。！？'"“”‘’]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}