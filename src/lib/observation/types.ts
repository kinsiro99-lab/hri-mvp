/**
 * Observation Console logging schema — NOT the Observation OS engine
 * (see src/lib/hri/v2/observation*.ts for that). This describes the
 * shape of a persisted session-level observation record, independent
 * of whatever storage backend eventually writes it.
 *
 * Implementation-independent by design: only plain, serializable
 * fields (string/number/boolean). No database-, file-, or
 * vendor-specific types (no ObjectId, Timestamp, JSONB wrapper,
 * etc.), so this schema stays stable across JSON → Neon → Supabase →
 * S3 → Analytics backends.
 */

export type ObservationEvent = {
  timestamp: string;
  sessionId: string;
  firstInput: string;
  turnCount: number;
  reflectionCompleted: boolean;
  feedback: string | null;
};
