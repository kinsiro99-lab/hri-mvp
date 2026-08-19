# Question Evolution Engine

Conceptual architecture only. No implementation, no scoring, no AI
model, no Engine changes. Builds on Question Quality / Answer Quality
/ Reality Response as already defined in `docs/ObservationOS.md`'s
HRI Vitality Model — this document does not redefine those terms, it
applies them per-Question across sessions and time.

## What this is, and isn't

HRI must learn which Questions actually improve Understanding. This
is experience-based evolution: patterns noticed across real completed
sessions, surfaced as proposals for a human to decide on.

- **Not machine learning.** No model is trained, no weights, no
  statistical inference beyond aggregating the Vitality Model's own
  per-session judgments across sessions.
- **Not automatic code modification.** Nothing in this document ever
  edits `questionStrategies.ts`, `questionPlanner.ts`, or any Engine
  file by itself.
- **Not real-time.** Evolution operates on completed, already-
  Observed sessions — never mid-conversation, never influencing the
  live Question Strategy selection for a session in progress.

## Question Identity

Before a Question can be observed, evaluated, remembered, or evolved
across sessions, it needs a stable identity that survives rephrasing.
A Question here is identified by:

- the **Observation Node** it targets,
- the **Question Strategy** it expresses,
- and, where more than one phrasing exists for the same
  Node × Strategy pairing, a **variant** identifier.

This is what lets Retire, Improve, Split, Merge, and Create Variant
(section 4) mean something concrete: they operate on this identity,
never on raw sentence text matched by keyword.

## 1. Question Observation

For every completed session, record — per Question asked — its
identity (Node × Strategy × variant), and:

- **Largest increase in understanding** — which Question in the
  session was followed by the answer with the highest Information
  Gain (per the Vitality Model's Answer Quality).
- **Almost no new understanding** — which Question was followed by
  an answer that restated what Understanding already had.

This step is observation of what already happened — no judgment is
formed yet; it is a record, not an evaluation.

## 2. Question Evaluation

Each recorded Question is evaluated along five conceptual dimensions:

- **Repetition** — did this Question (by identity, not phrasing)
  recur unnecessarily within or across sessions, asking for something
  the Observation Path had already covered.
- **Novelty** — the inverse: how much this Question's Node × Strategy
  pairing differed from what had already been asked in the session,
  contributing to Question Quality's diversity.
- **Reality Response** — as defined in the Vitality Model: did asking
  this Question leave HRI's Understanding of the user's actual
  situation less approximate than before.
- **Information Gain** — as defined in the Vitality Model: did the
  answer it produced add something Understanding did not already
  have.
- **Contribution to Reflection** — did the answer this Question
  produced end up meaningfully present in the session's Reflection,
  or was it observed and then never actually used.

Evaluation happens once per session per Question instance. Question
Memory (below) is what aggregates many such evaluations into a
judgment about the Question's identity over time.

## 3. Question Memory

Across many sessions, evaluations accumulate into a memory of each
Question identity's track record:

- **Effective questions** — a consistent record of high Reality
  Response and Information Gain wherever they are asked.
- **Weak questions** — a consistent record of low Reality Response
  or Information Gain, or high Repetition, regardless of Context.
- **Questions that work only in certain contexts** — strong in one
  Observation Context (Individual / Organization / Relationship /
  Project) and weak in another; the memory holds the
  Context-conditioned record, not a single overall verdict.
- **Questions that consistently fail** — near-zero Information Gain
  and Reality Response across every Context and session it has
  appeared in, distinguished from a question that is merely weak
  sometimes.

Question Memory is a record, held per Question identity, not a
trained model — it stays inspectable and explainable: "this Question
identity has this track record because of these past sessions."

## 4. Question Evolution

HRI never rewrites a Question automatically. What Question Memory
produces instead is a proposal, one of:

- **Retire** — memory shows consistent failure; stop asking this
  Question identity.
- **Improve** — memory shows a middling but not failing record;
  something about the phrasing or targeting could plausibly do better
  within the same Node × Strategy.
- **Split** — one Question identity is producing inconsistent results
  because it is conceptually doing two things; propose separating it
  into two more specific identities.
- **Merge** — two Question identities are producing near-identical
  results; propose consolidating them into one.
- **Create Variant** — an effective Question identity may be overused
  (Repetition risk); propose a new phrasing variant of the same
  Node × Strategy to preserve effectiveness while restoring novelty.
- **Prioritize** — among several available Questions for a given
  Node, propose which should be preferred first, based on accumulated
  track record.

Each proposal names the Question identity it concerns, the memory
evidence behind it, and which of the six actions it recommends. It
does not contain generated replacement text, code, or a ready-to-run
change — that is what Human Approval (below) is for.

## 5. Human Approval

Every proposed evolution requires developer approval before anything
changes.

- HRI suggests. Humans decide.
- A proposal is inert until approved — it does not gate, throttle, or
  alter the live Question Strategy selection for any session while
  pending.
- Approval, when given, is what would trigger a future, separately
  scoped implementation sprint (e.g. hand-editing
  `questionStrategies.ts`) — this document defines the proposal, not
  the change itself.

## 6. Evolution Report

Once a day, summarizing the day's completed sessions:

- **Today's strongest question** — highest Reality Response /
  Information Gain observed that day.
- **Today's weakest question** — lowest, excluding questions with too
  few observations that day to judge fairly.
- **Most improved question** — largest positive change in a Question
  identity's Question Memory track record compared to before that
  day.
- **Question needing redesign** — a Question identity whose memory
  crossed from "weak" into "consistently fails," a candidate for an
  Improve or Retire proposal.
- **Most successful question path** — the sequence of Question
  identities within a single session that produced the session's
  highest cumulative Reality Response.
- **Tomorrow's observation target** — which Question identity,
  Context, or Node × Strategy combination needs more sessions before
  Question Memory can judge it fairly.

The report is descriptive, matching Learning in the Vitality Model —
it states what was noticed, and where Evolution proposals (section 4)
came from, but the report itself proposes nothing new beyond what
section 4 already produced.

---

No scoring formula, statistical method, AI model, or code is defined
in this document. Implementation requires a separate, approved
sprint.
