/**
 * Shadow Context — Sprint12-B prototype.
 *
 * Standalone, dependency-free module: no imports from and no imports
 * by controller.ts / understandingEngine.ts / questionPlanner.ts /
 * observationPlanner.ts / decisionGate.ts / reflectionComposer.ts.
 * Nothing here is wired into the live Runtime — it exists purely so
 * this Sprint's CASE A~F can be verified by calling
 * `updateShadowContext()` directly from a script. See Sprint12-B Gate
 * report section B for why this Sprint deliberately keeps zero
 * coupling to the live engine rather than adding even a devLog-only
 * hook.
 *
 * Purpose: prove that multi-turn user text can be organized into a
 * *relational* structure (Situation / Direction / Constraint /
 * Response, connected by Tension) BEFORE any question is chosen —
 * without collapsing into a same-shaped clone of UnderstandingState's
 * 7 independent string slots.
 *
 * Design principle that separates this from SEMANTIC_GROUPS /
 * UnderstandingState: every rule here classifies a clause's
 * *discourse role* (is this a desire? a blocking condition? a
 * reaction? a walk-back of something already said?) using structural/
 * connective markers (싶다/어렵다/하지만/그냥/미뤄도 된다/...) that are
 * topic-independent. It never branches on a domain vocabulary bucket
 * (health/work/relationship keyword lists) the way
 * understandingEngine.ts's classifyXCandidate() functions do. The
 * same marker set is applied unmodified to CASE A (business trip),
 * CASE C (career), CASE D (memory), CASE F (fatigue) — four unrelated
 * domains — which is what makes this a role-structure layer rather
 * than a fifth topic dictionary.
 */

export type Provenance = "explicit" | "inferred";

export type Grounding = {
  turn: number;
  text: string;
  provenance: Provenance;
};

export type ElementKind = "situation" | "direction" | "constraint" | "response";

export type ShadowElement = {
  id: string;
  kind: ElementKind;
  description: string;
  /** Direction only: true when the user explicitly said they do NOT
   *  want this — the element is kept (never silently dropped) so the
   *  negation itself stays visible, but it must never be read as an
   *  active desire. */
  negated?: boolean;
  /** Constraint only: the element (Direction, usually) this constraint
   *  was found to limit. Absent when no attachable Direction existed
   *  at the time — see classifyClause()'s constraint branch. */
  blocks?: string;
  /** Response only: the element this reaction is about, when known. */
  about?: string;
  /** Revise/Deprioritize target: coarse status, defaults to "active". */
  status: "active" | "revised" | "deprioritized" | "conflicted";
  active: boolean;
  grounding: Grounding[];
};

export type Tension = {
  id: string;
  a: string;
  b: string;
  description: string;
  /** The relation itself is always inferred — see Sprint12-A report
   *  section E: two explicit elements can each be explicit while the
   *  fact that they conflict is a system judgment, not something the
   *  user stated in one sentence. */
  provenance: "inferred";
  status: "open" | "acknowledged";
  grounding: Grounding[];
};

export type QuestionWorthiness = "primary" | "secondary" | "excluded";

export type UnresolvedPoint = {
  id: string;
  relatesTo: string[];
  reason: string;
  worthiness: QuestionWorthiness;
};

export type ContextUpdateKind = "create" | "reinforce" | "specify" | "revise" | "conflict" | "deprioritize";

export type ContextUpdateLogEntry = {
  turn: number;
  elementId: string;
  kind: ContextUpdateKind;
  note: string;
};

export type ShadowContext = {
  situations: ShadowElement[];
  directions: ShadowElement[];
  constraints: ShadowElement[];
  responses: ShadowElement[];
  tensions: Tension[];
  unresolvedPoints: UnresolvedPoint[];
  updateLog: ContextUpdateLogEntry[];
};

export function emptyShadowContext(): ShadowContext {
  return {
    situations: [],
    directions: [],
    constraints: [],
    responses: [],
    tensions: [],
    unresolvedPoints: [],
    updateLog: [],
  };
}

/* =========================================================
 * Structural marker classification — role, not domain.
 * ========================================================= */

const DESIRE = /(싶|원한다|바란다|희망)/;
const NEAR_NEGATION = /(것은 아니|것이 아니|는 아니다|은 아니다|지 않|안 그렇|아니었)/;
const CONSTRAINT_PRED = /(어렵|힘들|못\s|못하|할 수 없|안 된|곤란|쉽지 않|끊기면)/;
const CONTRAST_LEAD = /^(하지만|그런데|그래도|근데)/;
const CAUSE_SPLIT = /(.+?)(어서|아서|여서|라서|때문에)(.+)/;
const REVISION = /(미뤄도|괜찮|필요없|아닌 것 같|더 준비하|조금 더|천천히|여유 있게|급하지 않)/;
const DEPRIORITIZE_TONE = /(그냥|가끔|별거 아니|중요하지 않)/;
const RESPONSE_PRED = /(걱정|답답|불안|기쁘|즐겁|아프|서운|편하|다행|반갑|그립|지루)/;
const ADDITIVE_LEAD = /(도\s|도$|또한|게다가|업무상으로도)/;
const PRIORITY_MARKER = /(우선해야|우선|먼저 하)/;
const INTENTION_MARKER = /(야겠다|겠다)/;
const EVALUATIVE_DIRECTION = /(나쁘지 않|좋을 것 같|좋겠다|괜찮다고)/;
const BOTH_REFERENCE = /(둘\s*다|둘다)/;
const CANCEL_MARKER = /(안 하기로|지 않기로|포기하|그만두기로|취소하|접기로)/;

type Classification = {
  desire: boolean;
  negatedDesire: boolean;
  constraint: boolean;
  constraintCause?: string;
  constraintBlock?: string;
  contrastLead: boolean;
  revision: boolean;
  deprioritizeTone: boolean;
  response: boolean;
  additiveLead: boolean;
  priority: boolean;
  intention: boolean;
  evaluativeDirection: boolean;
  bothReference: boolean;
  cancel: boolean;
};

function classifyClause(text: string): Classification {
  const desireMatch = DESIRE.test(text);
  const negated = desireMatch && NEAR_NEGATION.test(text);
  const constraintMatch = CONSTRAINT_PRED.test(text);
  let constraintCause: string | undefined;
  let constraintBlock: string | undefined;
  if (constraintMatch) {
    const split = text.match(CAUSE_SPLIT);
    if (split) {
      constraintCause = (split[1] + split[2]).trim();
      constraintBlock = split[3].trim();
    } else {
      constraintBlock = text;
    }
  }
  return {
    desire: desireMatch,
    negatedDesire: negated,
    constraint: constraintMatch,
    constraintCause,
    constraintBlock,
    contrastLead: CONTRAST_LEAD.test(text),
    revision: REVISION.test(text),
    deprioritizeTone: DEPRIORITIZE_TONE.test(text),
    response: RESPONSE_PRED.test(text),
    additiveLead: ADDITIVE_LEAD.test(text),
    priority: PRIORITY_MARKER.test(text),
    intention: INTENTION_MARKER.test(text),
    evaluativeDirection: EVALUATIVE_DIRECTION.test(text),
    bothReference: BOTH_REFERENCE.test(text),
    cancel: CANCEL_MARKER.test(text),
  };
}

/* =========================================================
 * Token overlap — simple, no ML. Used only to decide whether a new
 * clause is talking about an EXISTING element (reinforce/specify/
 * revise/deprioritize) or something new (create). A light suffix
 * strip removes common case/topic particles (은/는/이/가/을/를/도/...)
 * so "연락이" and "연락을" count as the same token — this is a generic
 * morphological normalization, not a domain word list, but it is
 * still a fixed suffix table, not a real morphological analyzer; see
 * Gate report section Q for its known limits (paraphrases with no
 * shared surface token still won't match).
 * ========================================================= */
const TRAILING_PARTICLES = ["에서", "으로", "이나", "하고", "은", "는", "이", "가", "을", "를", "도", "만", "와", "과", "의", "에", "로", "나"];
function stripParticle(word: string): string {
  for (const p of TRAILING_PARTICLES) {
    if (word.length > p.length + 1 && word.endsWith(p)) return word.slice(0, -p.length);
  }
  return word;
}
function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .split(/[\s,.!?"']+/)
      .filter((w) => w.length >= 2)
      .map(stripParticle),
  );
}
function overlapRatio(a: string, b: string): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const w of sa) if (sb.has(w)) shared++;
  return shared / Math.min(sa.size, sb.size);
}
const OVERLAP_THRESHOLD = 0.3;

function findReferenced(text: string, pool: ShadowElement[]): ShadowElement | undefined {
  let best: ShadowElement | undefined;
  let bestScore = 0;
  for (const el of pool) {
    if (!el.active && el.status !== "deprioritized") continue;
    const score = overlapRatio(text, el.description);
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return bestScore >= OVERLAP_THRESHOLD ? best : undefined;
}

function mostRecentActive(pool: ShadowElement[]): ShadowElement | undefined {
  for (let i = pool.length - 1; i >= 0; i--) {
    if (pool[i].active && !pool[i].negated) return pool[i];
  }
  return undefined;
}

/**
 * Discourse-coherence fallback: when a turn carries a revision/
 * de-emphasis tone but shares no token with anything on record, the
 * most ordinary reading is that it continues whatever was JUST
 * established (ordinary ellipsis/anaphora), not that it starts an
 * unrelated new topic. Only used inside the revision/deprioritize
 * branch — never for plain Situation/Direction creation — and only
 * after every token-overlap search across all four pools has failed.
 */
function mostRecentlyTouched(pools: ShadowElement[][]): ShadowElement | undefined {
  let best: ShadowElement | undefined;
  let bestTurn = -1;
  for (const pool of pools) {
    for (const el of pool) {
      if (!el.active) continue;
      const lastTurn = el.grounding[el.grounding.length - 1]?.turn ?? -1;
      if (lastTurn > bestTurn) {
        bestTurn = lastTurn;
        best = el;
      }
    }
  }
  return best;
}

let idCounter = 0;
function nextId(kind: string): string {
  idCounter += 1;
  return `${kind}-${idCounter}`;
}

function newElement(
  kind: ElementKind,
  description: string,
  turn: number,
  text: string,
  provenance: Provenance,
  extra?: Partial<ShadowElement>,
): ShadowElement {
  return {
    id: nextId(kind),
    kind,
    description,
    status: "active",
    active: true,
    grounding: [{ turn, text, provenance }],
    ...extra,
  };
}

/* =========================================================
 * Per-turn update.
 * ========================================================= */

export function updateShadowContext(
  prev: ShadowContext | undefined,
  turnText: string,
  turn: number,
): ShadowContext {
  const ctx: ShadowContext = prev
    ? {
        situations: [...prev.situations],
        directions: [...prev.directions],
        constraints: [...prev.constraints],
        responses: [...prev.responses],
        tensions: [...prev.tensions],
        unresolvedPoints: [...prev.unresolvedPoints],
        updateLog: [...prev.updateLog],
      }
    : emptyShadowContext();

  const text = turnText.trim();
  if (!text) return ctx;

  const c = classifyClause(text);

  // --- Revision / deprioritize / reinforce against an EXISTING element,
  // checked before creating anything new. This is what lets a later
  // turn change an earlier understanding instead of only appending.
  if (c.revision || c.deprioritizeTone) {
    const target =
      findReferenced(text, ctx.directions) ??
      findReferenced(text, ctx.constraints) ??
      findReferenced(text, ctx.situations) ??
      findReferenced(text, ctx.responses) ??
      mostRecentlyTouched([ctx.directions, ctx.constraints, ctx.situations, ctx.responses]);
    if (target) {
      const urgencyChange = /(미뤄도|급하지 않|여유 있게)/.test(text);
      const kind: ContextUpdateKind = urgencyChange ? "revise" : c.deprioritizeTone ? "deprioritize" : "specify";
      target.grounding = [...target.grounding, { turn, text, provenance: "explicit" }];
      target.status = kind === "revise" ? "revised" : kind === "deprioritize" ? "deprioritized" : target.status;
      target.description = `${target.description} (${text})`;
      ctx.updateLog.push({ turn, elementId: target.id, kind, note: text });

      const relatedTension = ctx.tensions.find((t) => t.a === target.id || t.b === target.id);
      if (relatedTension && kind !== "deprioritize") {
        relatedTension.status = "acknowledged";
        relatedTension.grounding = [...relatedTension.grounding, { turn, text, provenance: "inferred" }];
      }
      recomputeUnresolved(ctx, turn);
      return ctx;
    }
    // No existing element to revise against — REVISION/DEPRIORITIZE
    // markers alone never spawn structure; fall through to normal
    // classification (e.g. "그냥 가끔 생각이 난다" without a prior
    // element to attach to still needs somewhere to land as Response).
  }

  // --- Conflict: a later turn explicitly cancels/abandons something
  // that overlaps an EXISTING active (non-negated) Direction. Unlike
  // the negated-desire branch below (same-turn negation of a brand
  // new candidate), this fires only against a Direction already on
  // record from an earlier turn — the defining trait of Conflict
  // versus a same-turn negated Direction.
  if (c.cancel) {
    const target = findReferenced(text, ctx.directions);
    if (target && target.active && !target.negated) {
      target.status = "conflicted";
      target.active = false;
      target.grounding = [...target.grounding, { turn, text, provenance: "explicit" }];
      const el = newElement("direction", text, turn, text, "explicit", { negated: true });
      ctx.directions.push(el);
      ctx.updateLog.push({ turn, elementId: target.id, kind: "conflict", note: `cancelled by turn ${turn}: ${text}` });
      const relatedTension = ctx.tensions.find((t) => t.a === target.id || t.b === target.id);
      if (relatedTension) relatedTension.status = "acknowledged";
      recomputeUnresolved(ctx, turn);
      return ctx;
    }
  }

  // --- Reinforce check: near-duplicate of an existing element.
  const reinforceTarget =
    findReferenced(text, ctx.situations) ?? findReferenced(text, ctx.directions);
  if (reinforceTarget && overlapRatio(text, reinforceTarget.description) >= 0.6 && !c.desire && !c.constraint) {
    reinforceTarget.grounding = [...reinforceTarget.grounding, { turn, text, provenance: "explicit" }];
    ctx.updateLog.push({ turn, elementId: reinforceTarget.id, kind: "reinforce", note: text });
    recomputeUnresolved(ctx, turn);
    return ctx;
  }

  // --- Negated desire: preserve explicitly, never as an active Direction.
  if (c.desire && c.negatedDesire) {
    const el = newElement("direction", text, turn, text, "explicit", { negated: true });
    ctx.directions.push(el);
    ctx.updateLog.push({ turn, elementId: el.id, kind: "create", note: "negated desire preserved" });
    recomputeUnresolved(ctx, turn);
    return ctx;
  }

  // --- Direction: desire / priority / intention / mild evaluative desire.
  if ((c.desire || c.priority || c.intention || c.evaluativeDirection) && !c.negatedDesire) {
    const el = newElement("direction", text, turn, text, "explicit");
    if (c.bothReference) {
      // Explicit refusal to drop either side of an existing tension —
      // reinforce that tension instead of reading this as a new goal.
      const openTension = ctx.tensions.find((t) => t.status === "open");
      if (openTension) {
        openTension.grounding = [...openTension.grounding, { turn, text, provenance: "explicit" }];
        ctx.updateLog.push({ turn, elementId: openTension.id, kind: "reinforce", note: text });
        recomputeUnresolved(ctx, turn);
        return ctx;
      }
    }
    ctx.directions.push(el);
    ctx.updateLog.push({ turn, elementId: el.id, kind: "create", note: "direction" });
  }

  // --- Constraint: only becomes a Constraint element if there is an
  // active Direction it can plausibly block. Otherwise the same
  // predicate ("못", "어렵다"...) is just a plain Situation — this is
  // the rule that keeps CASE F free of invented Tension.
  if (c.constraint) {
    const recentDirection = mostRecentActive(ctx.directions);
    if (recentDirection) {
      const el = newElement("constraint", text, turn, text, "explicit", { blocks: recentDirection.id });
      ctx.constraints.push(el);
      ctx.updateLog.push({ turn, elementId: el.id, kind: "create", note: `blocks ${recentDirection.id}` });
    } else {
      const el = newElement("situation", text, turn, text, "explicit");
      ctx.situations.push(el);
      ctx.updateLog.push({ turn, elementId: el.id, kind: "create", note: "constraint predicate, no direction to block — recorded as situation" });
    }
  }

  // --- Response: reaction predicate, attached to the most recent
  // active Situation/Direction if one exists.
  if (c.response) {
    const about = mostRecentActive(ctx.situations) ?? mostRecentActive(ctx.directions);
    const el = newElement("response", text, turn, text, "explicit", { about: about?.id });
    ctx.responses.push(el);
    ctx.updateLog.push({ turn, elementId: el.id, kind: "create", note: about ? `about ${about.id}` : "unattached" });
  }

  // --- Situation: default bucket. Additive-lead ("~도") forces a NEW
  // situation rather than merging into the most recent one, even if
  // token overlap would otherwise suggest reinforcing it — this is
  // the rule CASE B needs to keep "친구 연락" and "업무 확인" separate.
  if (!c.desire && !c.constraint && !c.response && !c.priority && !c.intention && !c.evaluativeDirection) {
    if (c.additiveLead) {
      const el = newElement("situation", text, turn, text, "explicit");
      ctx.situations.push(el);
      ctx.updateLog.push({ turn, elementId: el.id, kind: "create", note: "additive-lead — kept separate from prior situation" });
    } else {
      const existing = findReferenced(text, ctx.situations);
      if (existing) {
        existing.grounding = [...existing.grounding, { turn, text, provenance: "explicit" }];
        ctx.updateLog.push({ turn, elementId: existing.id, kind: "specify", note: text });
      } else {
        const el = newElement("situation", text, turn, text, "explicit");
        ctx.situations.push(el);
        ctx.updateLog.push({ turn, elementId: el.id, kind: "create", note: "situation" });
      }
    }
  }

  recomputeTensions(ctx, turn);
  recomputeUnresolved(ctx, turn);
  return ctx;
}

/* =========================================================
 * Tension formation — only two paths, both requiring an actual
 * relation, never "one element exists so create a Tension":
 *  1. Direction <-> Constraint that already names `blocks`.
 *  2. Direction <-> Direction bridged by a contrast-lead turn.
 * ========================================================= */
function recomputeTensions(ctx: ShadowContext, turn: number): void {
  for (const constraint of ctx.constraints) {
    if (!constraint.blocks || !constraint.active) continue;
    const already = ctx.tensions.some((t) => t.a === constraint.blocks && t.b === constraint.id);
    if (already) continue;
    const direction = ctx.directions.find((d) => d.id === constraint.blocks);
    if (!direction || !direction.active || direction.negated) continue;
    ctx.tensions.push({
      id: nextId("tension"),
      a: direction.id,
      b: constraint.id,
      description: `${direction.description} ↔ ${constraint.description}`,
      provenance: "inferred",
      status: "open",
      grounding: [...direction.grounding, ...constraint.grounding],
    });
    ctx.updateLog.push({ turn, elementId: `${direction.id}~${constraint.id}`, kind: "create", note: "tension: direction vs constraint" });
  }

  // Direction vs Direction: only when >=2 active, non-negated
  // directions exist AND the later one arrived on a contrast-lead
  // turn (explicit "하지만"/"그런데" bridging two goals), never just
  // because two Directions happen to co-exist.
  const activeDirections = ctx.directions.filter((d) => d.active && !d.negated);
  if (activeDirections.length >= 2) {
    const last = activeDirections[activeDirections.length - 1];
    const lastGroundingText = last.grounding[last.grounding.length - 1]?.text ?? "";
    if (CONTRAST_LEAD.test(lastGroundingText) || classifyClause(lastGroundingText).contrastLead) {
      const prevDirection = activeDirections[activeDirections.length - 2];
      const already = ctx.tensions.some(
        (t) => (t.a === prevDirection.id && t.b === last.id) || (t.a === last.id && t.b === prevDirection.id),
      );
      if (!already) {
        ctx.tensions.push({
          id: nextId("tension"),
          a: prevDirection.id,
          b: last.id,
          description: `${prevDirection.description} ↔ ${last.description}`,
          provenance: "inferred",
          status: "open",
          grounding: [...prevDirection.grounding, ...last.grounding],
        });
        ctx.updateLog.push({ turn, elementId: `${prevDirection.id}~${last.id}`, kind: "create", note: "tension: direction vs direction" });
      }
    }
  }
}

/* =========================================================
 * UnresolvedPoint — derived only from OPEN tensions with no side yet
 * specified/acknowledged. Never generated from a merely-empty
 * category; an absent Constraint/Direction with nothing referencing
 * it produces no UnresolvedPoint at all.
 * ========================================================= */
function recomputeUnresolved(ctx: ShadowContext, _turn: number): void {
  const points: UnresolvedPoint[] = [];
  for (const t of ctx.tensions) {
    if (t.status !== "open") continue;
    points.push({
      id: `unresolved-${t.id}`,
      relatesTo: [t.a, t.b],
      reason: `"${t.description}" 사이의 관계가 아직 어느 쪽으로도 정리되지 않았습니다.`,
      worthiness: t.grounding.length >= 3 ? "primary" : "secondary",
    });
  }
  ctx.unresolvedPoints = points;
}
