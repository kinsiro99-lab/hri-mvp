/**
 * Beta Logging — currently DISABLED.
 *
 * Vercel's deployment filesystem is non-durable (ephemeral, and
 * read-only outside /tmp), so writing JSON log files under logs/ would
 * either throw on write or silently vanish on the next cold start.
 * Until a durable store (database, object storage, or a logging
 * service) is selected, this is an explicit no-op — callers always get
 * `persisted: false` back, never a false "success."
 */

export type LogAppendResult = {
  persisted: false;
  reason: string;
};

export function appendLogRecord(_record: Record<string, unknown>): LogAppendResult {
  return {
    persisted: false,
    reason: "Beta logging is disabled — no durable storage configured for this deployment.",
  };
}
