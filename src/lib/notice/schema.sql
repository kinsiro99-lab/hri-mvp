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

-- Multilingual Notice Gate — additive only, run once against the same
-- database this file's CREATE TABLE above targets. title/body stay
-- the ko-authoritative master, completely untouched by this; NULL
-- (every existing row, until an admin fills a translation in) is
-- exactly what src/lib/notice/types.ts's resolveNoticeContent()
-- already treats as "fall back to title/body" for every non-ko
-- locale, so this migration alone changes nothing about what's
-- currently displayed. Shape: { [locale]: { title, body } } for
-- locale in ja/en/fr/zh-CN/zh-HK/zh-TW only — ko is never a key here.
--
-- IMPORTANT — deployment order: run this BEFORE (or in the same
-- window as) deploying the code that SELECTs this column. Deploying
-- the code first, against a database that doesn't have this column
-- yet, makes every notices query throw (column does not exist),
-- which store.ts's existing fail-soft try/catch turns into an empty
-- result — the Notice card would silently disappear from Landing
-- until this migration runs.
ALTER TABLE notices
ADD COLUMN IF NOT EXISTS translations JSONB;
