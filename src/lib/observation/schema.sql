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
