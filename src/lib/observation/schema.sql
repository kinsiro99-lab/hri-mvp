-- Observation Console — Neon Postgres schema.
--
-- Run this manually against the Neon database (console SQL editor or
-- psql). The app does not run DDL itself — NeonObservationStorage
-- only ever INSERTs, so a missing table fails a single log write
-- (persisted:false) rather than being silently created mid-request.
--
-- No IP, user-agent, cookie, or other tracking columns by design —
-- see docs/RC_Sprint/RC_Sprint_02.md for the privacy constraints.

CREATE TABLE IF NOT EXISTS observation_events (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  session_id TEXT NOT NULL,
  first_input TEXT NOT NULL,
  turn_count INTEGER NOT NULL,
  reflection_completed BOOLEAN NOT NULL,
  feedback TEXT
);

-- Question Observation Foundation Sprint 01 — additive only. Neither
-- table below changes anything about observation_events above (no
-- ALTER, no column added to it); its existing rows, write path, and
-- meaning are untouched. Both new tables key off session_id (a plain
-- TEXT the client already generates) rather than a foreign key into
-- observation_events, since that table has no unique constraint on
-- session_id to reference and this sprint must not add one.
--
-- observation_turns — one row per (question shown, answer given) pair.
-- question_ref is nullable on purpose: no stable question/source
-- identifier exists yet in the live intelligence-core question path
-- (confirmed by the Beta Quality Completion audit), so this column is
-- reserved for one once it does, rather than being filled with a
-- fabricated id now.
CREATE TABLE IF NOT EXISTS observation_turns (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  session_id TEXT NOT NULL,
  turn_index INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_ref TEXT,
  answer_text TEXT NOT NULL,
  UNIQUE (session_id, turn_index)
);

-- observation_reflections — the final Reflection text for a session,
-- kept separate from observation_events (not an added column there)
-- so that table's existing write path never has to change.
CREATE TABLE IF NOT EXISTS observation_reflections (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  session_id TEXT NOT NULL,
  reflection_text TEXT NOT NULL
);

-- Reality Gain Observation Sprint 02 — additive only, does not touch
-- observation_turns/observation_reflections above (no ALTER, no
-- column added to either). One row per turn, classifying what
-- structurally changed in the live ContextGraph as a result of that
-- turn's answer — see src/lib/observation/types.ts's
-- ObservationRealityGain/RealityGainType for the exact classification
-- rule (derived only from counts the Runtime already computes, never
-- from wording/length/an LLM judge). gain_type is one of
-- NEW_REALITY / CLARIFICATION / RELATION / NO_STRUCTURAL_GAIN.
-- element_ref is nullable: a real ContextElement/ContextRelation id
-- when the live path produced one, never a fabricated identifier.
CREATE TABLE IF NOT EXISTS observation_reality_gains (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  session_id TEXT NOT NULL,
  turn_index INTEGER NOT NULL,
  gain_type TEXT NOT NULL,
  new_element_count INTEGER NOT NULL,
  updated_element_count INTEGER NOT NULL,
  new_relation_count INTEGER NOT NULL,
  element_ref TEXT,
  UNIQUE (session_id, turn_index)
);

-- Question Quality Evaluation V1 Sprint 03 — additive only, does not
-- touch observation_reality_gains above (no ALTER, no column added,
-- no row overwritten). One row per turn: a DETERMINISTIC judgment
-- derived only from that turn's already-recorded
-- observation_reality_gains row (join on session_id+turn_index to see
-- both) — never from wording, answer length, or a new LLM call. See
-- src/lib/observation/adapter.ts's evaluateQuestionQuality() for the
-- exact, reproducible rule. reality_gain/redundancy/grounding_safety/
-- information_gain are kept as separate columns (not collapsed into
-- one score) — NEW_REALITY is never treated as automatically superior
-- to CLARIFICATION/RELATION anywhere in this table or its write path.
-- grounding_safety is fixed 'NOT_OBSERVABLE' in V1 (no reliable
-- turn-level signal exists yet) — not a fabricated verdict.
CREATE TABLE IF NOT EXISTS observation_question_quality (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  session_id TEXT NOT NULL,
  turn_index INTEGER NOT NULL,
  evaluation_version TEXT NOT NULL,
  reality_gain TEXT NOT NULL,
  redundancy TEXT NOT NULL,
  grounding_safety TEXT NOT NULL,
  information_gain TEXT NOT NULL,
  provenance TEXT NOT NULL,
  UNIQUE (session_id, turn_index)
);
