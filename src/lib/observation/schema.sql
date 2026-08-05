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
