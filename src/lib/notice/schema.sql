-- Notice system — Neon Postgres schema.
--
-- Run this manually against the Neon database (console SQL editor or
-- psql), same convention as src/lib/observation/schema.sql: the app
-- never issues DDL itself, only INSERT/UPDATE/SELECT/DELETE, so a
-- missing table fails a single request rather than being silently
-- created mid-request.
--
-- Deliberately a SEPARATE table from observation_events — Notice
-- (operator-authored, admin-editable content) and Observation
-- (system-recorded session telemetry) are different kinds of data and
-- are never mixed into one table.

CREATE TABLE IF NOT EXISTS notices (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
