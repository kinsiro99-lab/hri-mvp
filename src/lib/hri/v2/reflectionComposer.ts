import type { UnderstandingState } from "./understandingEngine";
import { VOICE_GUIDE } from "./voiceGuide";
import type { ReflectionHint } from "./reflectionHint";
import type { ObservationGoal } from "./observationGoals";
import { resolveReflectionTitle } from "./reflectionTitle";
import type { EvidenceItem } from "./questionCorePrototype";

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
  evidence?: EvidenceItem[],
): ReflectionResult {
  void VOICE_GUIDE;

  switch (state.topic) {
    case "관계":
      return composeRelationshipReflection(state, hint, evidence);

    case "업무 압박":
      return composeWorkReflection(state, hint, evidence);

    case "기억":
      return composeMemoryReflection(state, hint, evidence);

    case "몸 상태":
      return composeHealthReflection(state, hint, evidence);

    default:
      return composeDefaultReflection(state, hint, evidence);
  }
}

/* =========================================================
 * Gate 4B — minimal Evidence-line connect (ADD ONLY).
 *
 * Proves the data path only: does an Evidence item still alive in the
 * new Question Core's prototypeEvidence actually reach the Reflection
 * output. Not a summarization design — exactly one candidate, appended
 * after the existing body, never touching the 5 domain composers'
 * existing lines/fieldTags/emphasize/compactUnique pipeline above. When
 * no candidate qualifies, output is byte-identical to before this Gate.
 * ========================================================= */

/**
 * active only (never superseded — a corrected-away claim must never
 * read as current), and never one already represented verbatim by the
 * old engine's own fields (avoids restating the same line twice from
 * two different data sources).
 *
 * Gate 6B — selection is POSITIONAL only (array/turn order), never a
 * "meaningfulness" judgment: no scoring, no keyword weighing, no
 * length heuristic. Rule (fixed, not tunable by content):
 *   0 candidates -> []
 *   1            -> that one
 *   2            -> both (first + latest)
 *   3            -> first + latest only (middle deliberately dropped —
 *                    per this Gate's spec, not an oversight)
 *   4+           -> first + one positional midpoint + latest, capped
 *                    at 3 total. Midpoint = Math.floor(n / 2) by index,
 *                    a fixed formula, not a relevance pick.
 */
function selectEvidenceCandidates(
  evidence: EvidenceItem[] | undefined,
  state: UnderstandingState,
): EvidenceItem[] {
  if (!evidence || evidence.length === 0) return [];

  const alreadyRepresented = new Set(
    [state.target, state.wish, state.emotion, state.meaning, state.presentState]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim()),
  );

  const candidates = evidence.filter(
    (item) => item.status === "active" && !alreadyRepresented.has(item.text.trim()),
  );

  const n = candidates.length;
  if (n === 0) return [];
  if (n === 1) return [candidates[0]];
  if (n === 2) return [candidates[0], candidates[1]];
  if (n === 3) return [candidates[0], candidates[2]];

  const middleIndex = Math.floor(n / 2);
  return [candidates[0], candidates[middleIndex], candidates[n - 1]];
}

/** Position labels for a 2- or 3-item continuity line — temporal
 *  ordering words only, never a claim about WHY items relate. */
const CONTINUITY_LABELS: Record<number, readonly string[]> = {
  2: ["처음", "이후"],
  3: ["처음", "이후", "최근"],
};

/**
 * Particle-independent by construction (same reason as
 * questionCorePrototype.ts's "dash-quote aside" pattern): "도"/"처럼"
 * never change form for batchim, so this is safe for any quoted user
 * text regardless of how it ends — no new "'...다'이라는"-class grammar
 * bug is introduced here (Gate 5). Uncertain evidence is phrased as
 * something the user said, not promoted to a settled claim — applied
 * per item, so a stated item and an uncertain item in the same line
 * each keep their own honest register.
 */
function phraseEvidenceItem(item: EvidenceItem, label: string, terminal: boolean): string {
  const tail = terminal ? "있었습니다." : "있었고,";
  return item.certainty === "uncertain"
    ? `${label} 말씀에는 '${item.text}'처럼 아직 확실하지 않다는 표현도 ${tail}`
    : `${label} 말씀에는 '${item.text}'도 ${tail}`;
}

function buildEvidenceLine(evidence: EvidenceItem[] | undefined, state: UnderstandingState): string | undefined {
  const candidates = selectEvidenceCandidates(evidence, state);
  if (candidates.length === 0) return undefined;

  if (candidates.length === 1) {
    const only = candidates[0];
    return only.certainty === "uncertain"
      ? `이후 이어진 말씀 중에는 '${only.text}'처럼 아직 확실하지 않다는 표현도 있었습니다.`
      : `이후 이어진 말씀에는 '${only.text}'도 있었습니다.`;
  }

  const labels = CONTINUITY_LABELS[candidates.length] ?? [];
  return candidates
    .map((item, index) => phraseEvidenceItem(item, labels[index] ?? "", index === candidates.length - 1))
    .join(" ");
}

function withEvidenceLine(result: ReflectionResult, evidence: EvidenceItem[] | undefined, state: UnderstandingState): ReflectionResult {
  const evidenceLine = buildEvidenceLine(evidence, state);
  if (!evidenceLine) return result;
  return { ...result, body: result.body ? `${result.body}\n\n${evidenceLine}` : evidenceLine };
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
  evidence?: EvidenceItem[],
): ReflectionResult {
  const lines: Array<string | undefined> = [
    state.target
      ? `지금 관계의 흐름에서 가장 선명하게 떠오른 것은 '${clean(state.target)}'입니다.`
      : state.relationship
        ? `마음에는 '${clean(state.relationship)}'의 형태로 이어진 관계가 남아 있습니다.`
        : "한 사람과의 연결이 아직 마음 안에 남아 있습니다.",

    state.presentState
      ? `그 관계의 현재 상태를 나타내는 말은 '${clean(state.presentState)}'입니다.`
      : undefined,

    state.emotion
      ? `그 안에는 감정으로 '${clean(state.emotion)}'도 함께 머물고 있습니다.`
      : undefined,

    state.wish
      ? `마음이 그 관계에서 향하는 바람은 '${clean(state.wish)}'입니다.`
      : undefined,

    state.meaning
      ? `그 흐름에는 의미로 '${clean(state.meaning)}'도 함께 남아 있습니다.`
      : undefined,
  ];
  const fieldTags: SemanticField[] = ["target", "presentState", "emotion", "wish", "meaning"];
  const body = compactUnique(emphasize(lines, fieldTags, hint));

  return withEvidenceLine(
    {
      title: resolveReflectionTitle(state, hint),
      body,
      closing:
        "지금은 그 관계를 판단하기보다, 마음에 남아 있는 연결과 바람을 조용히 바라보는 지점에 가까워 보입니다.",
    },
    evidence,
    state,
  );
}

function composeWorkReflection(
  state: UnderstandingState,
  hint?: ReflectionHint,
  evidence?: EvidenceItem[],
): ReflectionResult {
  const lines: Array<string | undefined> = [
    state.target
      ? `현재 업무 흐름에서 가장 선명하게 드러난 것은 '${clean(state.target)}'입니다.`
      : "현재의 흐름은 업무를 중심으로 이어지고 있습니다.",

    state.presentState
      ? `지금의 업무 상태를 나타내는 말은 '${clean(state.presentState)}'입니다.`
      : undefined,

    state.emotion
      ? `그 과정에는 감정으로 '${clean(state.emotion)}'도 함께 남아 있습니다.`
      : undefined,

    state.wish
      ? `마음이 그 상황에서 향하는 바람은 '${clean(state.wish)}'입니다.`
      : undefined,

    state.meaning
      ? `그 흐름에는 의미로 '${clean(state.meaning)}'도 함께 놓여 있습니다.`
      : undefined,
  ];
  const fieldTags: SemanticField[] = ["target", "presentState", "emotion", "wish", "meaning"];
  const body = compactUnique(emphasize(lines, fieldTags, hint));

  return withEvidenceLine(
    {
      title: resolveReflectionTitle(state, hint),
      body,
      closing:
        "지금은 해결을 서두르기보다, 현재의 상태와 마음이 향하는 곳을 먼저 바라보는 단계에 가까워 보입니다.",
    },
    evidence,
    state,
  );
}

function composeMemoryReflection(
  state: UnderstandingState,
  hint?: ReflectionHint,
  evidence?: EvidenceItem[],
): ReflectionResult {
  const lines: Array<string | undefined> = [
    state.target
      ? `지금 가장 선명하게 떠오른 것은 '${clean(state.target)}'입니다.`
      : "현재의 마음은 하나의 기억을 중심으로 이어지고 있습니다.",

    state.presentState
      ? `그 기억의 현재 모습을 나타내는 말은 '${clean(state.presentState)}'입니다.`
      : undefined,

    state.emotion
      ? `그 장면과 함께 감정으로 '${clean(state.emotion)}'도 이어지고 있습니다.`
      : undefined,

    state.wish
      ? `마음이 그 기억을 따라 움직이는 바람은 '${clean(state.wish)}'입니다.`
      : undefined,

    state.meaning
      ? `그 안에는 의미로 '${clean(state.meaning)}'도 함께 머물고 있습니다.`
      : undefined,
  ];
  const fieldTags: SemanticField[] = ["target", "presentState", "emotion", "wish", "meaning"];
  const body = compactUnique(emphasize(lines, fieldTags, hint));

  return withEvidenceLine(
    {
      title: resolveReflectionTitle(state, hint),
      body,
      closing:
        "지금은 그 기억을 결론짓기보다, 그 안에 남아 있는 감정과 바람을 천천히 바라보는 지점에 가까워 보입니다.",
    },
    evidence,
    state,
  );
}

function composeHealthReflection(
  state: UnderstandingState,
  hint?: ReflectionHint,
  evidence?: EvidenceItem[],
): ReflectionResult {
  const lines: Array<string | undefined> = [
    state.target
      ? `지금 몸 상태에서 가장 선명하게 느껴지는 것은 '${clean(state.target)}'입니다.`
      : "현재의 흐름은 몸 상태를 중심으로 이어지고 있습니다.",

    state.presentState
      ? `현재 상태를 나타내는 말은 '${clean(state.presentState)}'입니다.`
      : undefined,

    state.emotion
      ? `그 상태와 함께 감정으로 '${clean(state.emotion)}'도 남아 있습니다.`
      : undefined,

    state.wish
      ? `마음이 그 안에서 향하는 바람은 '${clean(state.wish)}'입니다.`
      : undefined,

    state.meaning
      ? `이 흐름에는 의미로 '${clean(state.meaning)}'도 함께 놓여 있습니다.`
      : undefined,
  ];
  const fieldTags: SemanticField[] = ["target", "presentState", "emotion", "wish", "meaning"];
  const body = compactUnique(emphasize(lines, fieldTags, hint));

  return withEvidenceLine(
    {
      title: resolveReflectionTitle(state, hint),
      body,
      closing:
        "지금은 상태를 단정하기보다, 몸과 마음에 나타난 흐름을 조심스럽게 바라보는 단계에 가까워 보입니다.",
    },
    evidence,
    state,
  );
}

function composeDefaultReflection(
  state: UnderstandingState,
  hint?: ReflectionHint,
  evidence?: EvidenceItem[],
): ReflectionResult {
  const lines: Array<string | undefined> = [
    state.topic
      ? `현재 마음의 흐름의 중심에는 '${clean(state.topic)}'도 있습니다.`
      : "아직 하나의 방향으로 정리되기보다, 떠오른 것을 조심스럽게 확인하는 흐름에 가깝습니다.",

    state.target
      ? `그 안에서 가장 선명하게 드러난 것은 '${clean(state.target)}'입니다.`
      : undefined,

    state.presentState
      ? `현재 상태를 나타내는 말은 '${clean(state.presentState)}'입니다.`
      : undefined,

    state.emotion
      ? `그 흐름에는 감정으로 '${clean(state.emotion)}'도 함께 남아 있습니다.`
      : undefined,

    state.wish
      ? `마음이 그 안에서 향하는 바람은 '${clean(state.wish)}'입니다.`
      : undefined,

    state.meaning
      ? `또한 의미로 '${clean(state.meaning)}'도 함께 놓여 있습니다.`
      : undefined,
  ];
  const fieldTags: SemanticField[] = ["topic", "target", "presentState", "emotion", "wish", "meaning"];
  const body = compactUnique(emphasize(lines, fieldTags, hint));

  return withEvidenceLine(
    {
      title: resolveReflectionTitle(state, hint),
      body,
      closing:
        "지금은 이 흐름을 판단하기보다, 마음에 나타난 상태와 바람을 차분히 바라보는 지점에 가까워 보입니다.",
    },
    evidence,
    state,
  );
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

/* =========================================================
 * Gate 12 — Minimal Natural Reflection (ADD ONLY, not wired
 * into controller.ts this Gate — see module doc below).
 *
 * Output Authority Contract (Gate 10/11):
 *   LEVEL 1 USER VERBATIM        — evidence.text, unedited
 *   LEVEL 2 USER-STATED STRUCTURE — a reason/contrast/conclusion
 *     marker the user's OWN sentence already contains; never used
 *     to link across turns, only to pick which lead phrase quotes it
 *   LEVEL 3 SEQUENCE-SAFE        — 먼저/이어/그리고 style lead phrases,
 *     coexistence only, never a causal/importance claim
 *   LEVEL 4 HRI INTERPRETATION   — not produced anywhere below
 *
 * old Understanding is not read here at all (no PRIMARY, no fallback
 * inside this function) — every active evidence item is included
 * unconditionally, no first/middle/latest selection, no scoring.
 * ========================================================= */

type StructuralSignal = "reason" | "contrast" | "conclusion";

/**
 * Gate 11 audit result: "아서"/"어서" (reason-vs-sequence ambiguous,
 * unsafe without morphological analysis) and "따라서" (conclusion vs
 * "~에 따라서"/"따르다" verb form, high false-positive) are
 * deliberately excluded. "라서"/"지만" are bound grammatical endings
 * that are safe in MEANING but could theoretically appear mid-word,
 * so they require a lightweight word-boundary check (trailing space/
 * comma/period/end-of-string) rather than a bare substring match.
 */
const REASON_MARKERS = ["때문에", "때문이다", "때문입니다", "때문이라", "그래서"];
const CONTRAST_MARKERS = ["하지만", "그렇지만", "그러나", "반면"];
const CONCLUSION_MARKERS = ["결국", "결론적으로"];

function hasBoundedSuffix(text: string, suffix: string): boolean {
  return (
    text.includes(`${suffix} `) ||
    text.includes(`${suffix},`) ||
    text.includes(`${suffix}.`) ||
    text.endsWith(suffix)
  );
}

/**
 * Pure, closed-union classification of a SINGLE evidence text's own
 * self-declared structure — never reads any other evidence, never
 * infers what a marker relates to. Multiple tags are expected (see
 * Gate 11 CASE C T5: one sentence carrying both "때문에" and "결국").
 */
function detectStructuralSignals(text: string): StructuralSignal[] {
  const signals: StructuralSignal[] = [];
  if (REASON_MARKERS.some((m) => text.includes(m)) || hasBoundedSuffix(text, "라서")) {
    signals.push("reason");
  }
  if (CONTRAST_MARKERS.some((m) => text.includes(m)) || hasBoundedSuffix(text, "지만")) {
    signals.push("contrast");
  }
  if (CONCLUSION_MARKERS.some((m) => text.includes(m))) {
    signals.push("conclusion");
  }
  return signals;
}

/**
 * Grammar safety (Gate 5 precedent): never attach "라는"/"다고"/
 * "이라고" directly to a quoted evidence string — a copula ending
 * ("...이다") needs "이라고" while a plain verb ending ("...싶다")
 * needs "다고", and picking wrong reproduces the exact "'...다'
 * 이라는" bug class. Every template below closes the quote with only
 * "도" (batchim-invariant), and puts the signal-aware wording in a
 * FIXED lead phrase before the quote instead — same "dash-quote
 * aside" principle as questionCorePrototype.ts and Gate 4B/5/6B.
 *
 * "이유로" this task explains and "결론으로" this task concludes are
 * never asserted for anything outside the quote itself — no target
 * evidence id, no prior-turn reference (Gate 11 §4: relation target
 * inference is out of scope and stays out of scope here).
 */
function leadPhraseFor(signals: StructuralSignal[], position: number, total: number): string {
  if (signals.includes("reason")) return "그 이유로는";
  if (signals.includes("conclusion")) return "그 결론으로는";
  if (position === 0) return "먼저";
  if (position === total - 1 && total > 1) return "그리고";
  return "이어";
}

function renderEvidenceClause(item: EvidenceItem, position: number, total: number): string {
  const signals = detectStructuralSignals(item.text);
  const lead = leadPhraseFor(signals, position, total);

  return item.certainty === "uncertain"
    ? `${lead} '${item.text}'처럼 아직 확실하지 않다는 표현도 있었습니다.`
    : `${lead} '${item.text}'도 있었습니다.`;
}

export type NaturalReflectionResult = {
  body: string;
  /** Every active evidence text actually reflected in `body` — for
   *  Source Audit (Gate 12 §11): sourceRefs.length should always equal
   *  the active-evidence input count, by construction (no selection). */
  sourceRefs: string[];
};

/**
 * Not called from controller.ts this Gate (see Gate 12 §12 — wiring
 * is a separate future Gate's decision). superseded items are
 * excluded (never re-presented as current); every remaining active
 * item is included unconditionally — no first/middle/latest, no
 * importance ranking, no old Understanding read anywhere in this
 * function.
 */
export function composeNaturalReflection(evidence: EvidenceItem[] | undefined): NaturalReflectionResult {
  const active = (evidence ?? []).filter((item) => item.status === "active");
  if (active.length === 0) return { body: "", sourceRefs: [] };

  const body = active.map((item, index) => renderEvidenceClause(item, index, active.length)).join(" ");

  return { body, sourceRefs: active.map((item) => item.text) };
}