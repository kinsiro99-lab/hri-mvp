# RC Sprint 01 — Observation Console: logging contract

## Original goal

Create the foundation for Observation Console logging: an
`ObservationEvent` schema and durable storage for it, without
touching Engine behavior.

## Decision: no local JSON file storage

The original plan called for `POST /api/log` to append records to
`/data/logs.json`. That was rejected during audit:

- Beta is already running on **Vercel Production**.
- Vercel's deployment filesystem is ephemeral and read-only outside
  `/tmp`. A `/data/logs.json` write would either throw at request
  time or silently disappear on the next cold start / redeploy.
- The repo already has an honest no-op for this exact reason — see
  [`src/lib/hri/logStore.ts`](../../src/lib/hri/logStore.ts) and
  [`src/app/api/log/route.ts`](../../src/app/api/log/route.ts), which
  return `501` / `persisted: false` rather than a false `200`.

That existing behavior is **unchanged** by this sprint. `route.ts`
and `logStore.ts` were not edited.

## What this sprint builds instead

Only the contract — schema and storage interface, no persistence,
no engine wiring:

- **`src/lib/observation/types.ts`** — `ObservationEvent`: the shape
  of one session-level observation record (`timestamp`, `sessionId`,
  `firstInput`, `turnCount`, `reflectionCompleted`, `feedback`).
  Implementation-independent by design — plain serializable fields
  only, no database- or vendor-specific types — so the schema stays
  stable regardless of backend (JSON → Neon → Supabase → S3 →
  Analytics).

- **`src/lib/observation/storage.ts`** — `ObservationStorage`
  interface (`record(event): Promise<{ persisted, reason? }>`) plus
  `NoopObservationStorage`, a concrete implementation that honestly
  reports `persisted: false`. A future backend (Neon Postgres is the
  current front-runner, not yet provisioned) implements the same
  interface without changing this schema or any caller.

## Explicitly out of scope this sprint

- No filesystem persistence.
- No database connection or provisioning (Neon or otherwise).
- No changes to `route.ts` or `logStore.ts` — the existing honest
  501 no-op behavior stands.
- No changes to Engine/Runtime code (`controller.ts`,
  `understandingEngine.ts`, `selector.ts`, planner, reducer,
  reflection logic).
- Nothing in `src/lib/observation/` is imported into the live
  pipeline yet.

## Next step (future sprint, not this one)

Wire `route.ts` to use `ObservationStorage` (starting with
`NoopObservationStorage`, matching current behavior exactly), then
swap in a real adapter once a durable backend is chosen and
provisioned.
