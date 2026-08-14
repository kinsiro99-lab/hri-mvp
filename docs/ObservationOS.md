# HRI Observation OS

## Beta Bridges

A **Beta Bridge** is a hand-authored mapping between two type systems
that were designed independently and have no natural correspondence.
Each one exists only to let the current Beta (individual/organization
context only) function end-to-end; none of them is a permanent
semantic equivalence. Each is tagged `BETA_BRIDGE: <name>` at its
definition site in code, so it can be found with a single search.

Do not let any of these become silent permanent semantics — if a
change elsewhere in the codebase would make one obsolete, that removal
condition should be checked before adding new logic on top of it.

---

### SLOT_NODE_BY_CONTEXT

- **File**: `src/lib/hri/v2/observationPlanner.ts`
- **Why it exists**: `Slot` (questionPlanner.ts's vocabulary — topic,
  target, emotion, relationship, presentState, meaning, wish) and
  `ObservationNode` (observationPaths.ts's vocabulary — situation,
  emotion, meaning, direction, change, tension, priority, connection,
  memory, status, obstacle, risk) were designed independently, for
  different purposes, at different times. `planObservation()` needs to
  know which node the Planner's currently-asked Slot corresponds to;
  nothing in the codebase supplied that correspondence, so it was
  authored.
- **Affected files**: `src/lib/hri/v2/observationPlanner.ts` only
  (definition + every consumer: `currentNode`/`nextNode`/`alternateSlot`
  resolution inside `planObservation()`).
- **Known limitation**: The mapping is lossy — several Slots collapse
  onto the same Node (e.g. under organization, both `emotion` and
  `presentState` map to `tension`; under individual, `topic`, `target`,
  `relationship`, and `presentState` all map to `situation`).
  `relationship` has no dedicated node on either active path at all and
  defaults conservatively to `situation`. This means the Observation
  Planner can only ever reason at the resolution Slot already provides,
  not at true Node resolution.
- **Exact removal condition**: Remove once the Question Planner stops
  being Slot-based and probes directly by `ObservationNode` (i.e. the
  Observation OS gets its own native probing surface instead of
  borrowing questionPlanner.ts's 7-value Slot vocabulary), or once a
  future Observation Node/Intent layer subsumes Slot-based planning
  entirely.

---

### GOAL_STRATEGY_POLICY

- **File**: `src/lib/hri/v2/observationPlanner.ts`
- **Why it exists**: `ObservationGoal` (observationGoals.ts — WHY,
  e.g. identify/stabilize/interpret) and `QuestionStrategy`
  (questionStrategies.ts — HOW, e.g. clarify/explore/tension) were
  designed independently. Step 3 needed a Goal to inform which of a
  node's existing strategies to prefer; no Goal→Strategy correspondence
  existed, so this ranking policy was authored. It was deliberately
  built as a *preference ranking* over each node's own existing
  strategy set (reorders, never adds or drops a strategy) rather than a
  fixed equivalence, anticipating a future Observation Intent layer
  between Goal and Strategy.
- **Affected files**: `src/lib/hri/v2/observationPlanner.ts`
  (`rankStrategiesByGoal()`, `ObservationPlan.desiredStrategy` /
  `.desiredStrategies`).
- **Known limitation**: The ranking is hand-authored preference data,
  not derived from any principled model of how a Goal should express
  itself as a Strategy. `integrate` and `reorient` currently share an
  identical preference list. `connect` and `expand` are unreachable
  from any individual/organization transition today (see
  `observationGoals.ts`'s `OBSERVATION_GOALS`), so their entries are
  untested in practice.
- **Exact removal condition**: Remove once an Observation Intent layer
  (already anticipated in this constant's own doc comment) sits between
  Goal and Strategy and derives strategy preference from a principled
  model instead of a hand-authored table — or once product/UX data
  justifies a permanent, non-Beta strategy-selection policy.

---

### GOAL_EMPHASIS_FIELDS

- **File**: `src/lib/hri/v2/reflectionComposer.ts`
- **Why it exists**: Step 5 needed `ObservationGoal` to inform which
  already-existing Reflection sentence to emphasize (move to the front
  of the body). `UnderstandingState`'s semantic fields (topic, target,
  presentState, emotion, relationship, wish, meaning) were designed
  independently of `ObservationGoal` and have no native correspondence
  — most sharply for `prioritize`, for which no dedicated "priority"
  field exists in `UnderstandingState` at all, so `meaning`/
  `presentState` stand in as the closest available carriers.
- **Affected files**: `src/lib/hri/v2/reflectionComposer.ts`
  (`emphasize()`, and every one of the five topic-specific composer
  functions that pass their `fieldTags` array against it).
- **Known limitation**: `prioritize`'s mapping to `meaning`/
  `presentState` is a semantic approximation, not a real "priority"
  concept. `connect`'s mapping to `relationship` is structurally
  unreachable in 4 of the 5 composer functions (relationship has no
  standalone line — it's folded into the same array slot as `target`
  in `composeRelationshipReflection`) and is unreachable at runtime
  today anyway, since `connect` cannot be produced by any
  individual/organization transition.
- **Exact removal condition**: Remove once `UnderstandingState` gains a
  dedicated field for priority (or Reflection reads a richer content
  model than the current 7 fields), or once `ObservationGoal`'s own
  vocabulary is revised to align with what Reflection can actually
  express.

---

## HRI Vitality Model

Conceptual model only — no scoring formula, no implementation, no
code. This section defines how HRI evaluates its own conversations,
distinct from how it conducts them. Vitality asks a second-order
question the Engine itself never asks mid-session: *was this
Observation alive, or was it going through the motions?*

Evaluation happens after a session (or a segment of one), never
during it — it observes the Observation OS's own output, not the
user. It informs Learning and Growth (below), not the live Question
Strategy or Reflection composition. Vitality evaluation is not a Slot,
not a Node, not a Goal — it never feeds back into the same Rhythm it
is evaluating.

### 1. Question Quality

Whether a Question, on its own, was a good move for HRI to have made
in the Observation it was placed into.

- **Repetition** — whether this Question asked for something the
  session had already Observed, under a different phrasing.
  Repetition is a failure of Observation continuity: it means the
  Question Strategy lost track of what the Observation Path had
  already covered.
- **Diversity** — whether the session's Questions, taken together,
  moved across different Observation Goals/Nodes rather than
  circling the same one. A conversation can ask many distinct
  sentences and still fail diversity if they all serve the same
  Goal.
- **Appropriateness** — whether the Question matched the Observation
  Context it was asked inside (Individual / Organization /
  Relationship / Project). A Question appropriate to one Context can
  be a category error in another.
- **Contribution** — whether the Question, once answered, actually
  advanced the Observation Path — gave the next Transition something
  new to work with — rather than being answerable without changing
  what HRI understood.

### 2. Answer Quality

Whether the user's Answer gave the Observation OS something to work
with, independent of whether the Question that produced it was good.

- **Information gain** — whether the Answer added something to
  Understanding that was not already present, versus restating the
  Question's own premise back.
- **Emotional progression** — whether the Answer showed movement in
  the user's relationship to what they were describing (e.g. from
  situation toward feeling, from feeling toward meaning), rather than
  staying at the same register across turns.
- **Clarity** — whether the Answer was concrete enough for
  Observation to act on, versus abstract to the point that no
  Transition could be planned from it.
- **Continuity** — whether the Answer connected to what came before
  it in the session, versus introducing an unrelated thread that the
  Observation Path was not tracking.

### 3. Reality Response

Whether a Question actually moved the conversation closer to the
user's real situation — not whether the Answer sounded rich, and not
whether particular words appeared.

This is deliberately not keyword matching, and not a check against
any fixed vocabulary. It is a conceptual judgment: did the exchange
leave HRI's Understanding of the user's actual circumstance less
approximate than it was before the Question was asked? A Question can
produce a long, articulate Answer that still leaves Reality Response
flat, if the Answer stayed at the level of description HRI already
had. A short, plain Answer can score highly if it corrected or
sharpened HRI's model of the real situation.

Reality Response is the difference between "the user said more" and
"HRI now understands the user's situation better."

### 4. Learning

What did HRI learn today?

Learning is Vitality looking backward across completed sessions to
ask what the Observation OS now knows that it did not know before —
about a Context's typical Observation Paths, about which Question
Strategies tend to produce high Reality Response in that Context,
about where repetition or low diversity tends to creep in. Learning
is descriptive: a statement of what was noticed, not yet a directive
about what to change.

### 5. Growth

What should HRI improve tomorrow?

Growth takes what Learning noticed and turns it into a direction —
still conceptual, not a formula or a code change. Growth names which
of the four Vitality dimensions above is currently weakest for a
given Context or Observation Path, and what kind of change (to
Question Strategy preference, to Transition timing, to Reflection
emphasis) would plausibly address it. Growth does not prescribe the
change itself — it is the input a future implementation sprint would
need, not the implementation.

---

No scoring formula, thresholds, or code are defined in this section.
Implementation of any of the above requires a separate, approved
sprint.
