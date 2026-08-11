import { neon } from "@neondatabase/serverless";
import { notFound } from "next/navigation";

// Internal developer viewer for the Observation Console — read-only.
// Gated by a server-only shared secret (ADMIN_ACCESS_KEY); see
// isAuthorized below. Exists solely to verify that /api/log -> Neon
// writes are actually landing. Queries observation_events directly;
// no schema or event-model changes.
export const dynamic = "force-dynamic";

const ROW_LIMIT = 200;

type ObservationRow = {
  id: number;
  timestamp: Date | string;
  session_id: string;
  first_input: string;
  turn_count: number;
  reflection_completed: boolean;
  feedback: string | null;
};

async function fetchRecentEvents(): Promise<
  { rows: ObservationRow[]; error: string | null }
> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return { rows: [], error: "DATABASE_URL is not configured — nothing to read." };
  }

  try {
    const sql = neon(connectionString, {
      fetchOptions: { cache: "no-store" },
    });
    const rows = (await sql`
      SELECT id, timestamp, session_id, first_input, turn_count, reflection_completed, feedback
      FROM observation_events
      ORDER BY id DESC
      LIMIT ${ROW_LIMIT}
    `) as ObservationRow[];
    return { rows, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown query error";
    return { rows: [], error: message };
  }
}

// Server-only comparison — ADMIN_ACCESS_KEY (no NEXT_PUBLIC_ prefix)
// never reaches the client bundle. Missing env var or missing/wrong
// key both resolve to notFound(), so the page is indistinguishable
// from a route that doesn't exist.
function isAuthorized(providedKey: string | undefined): boolean {
  const accessKey = process.env.ADMIN_ACCESS_KEY;
  return Boolean(accessKey) && providedKey === accessKey;
}

export default async function ObservationEventsPage({
  searchParams,
}: {
  searchParams: { key?: string };
}) {
  // TEMPORARY DIAGNOSTIC — remove after production admin auth issue is
  // resolved. Logs only booleans/lengths/derived comparisons, never the
  // secret value or the provided key value, to server-side Vercel
  // function logs (never rendered to the client).
  {
    const accessKey = process.env.ADMIN_ACCESS_KEY;
    const providedKey = searchParams.key;

    console.log("[ADMIN_AUTH_DIAGNOSTIC]", {
      envExists: Boolean(accessKey),
      envLength: accessKey?.length ?? 0,
      queryExists: Boolean(providedKey),
      queryLength: providedKey?.length ?? 0,
      lengthsMatch:
        (accessKey?.length ?? -1) === (providedKey?.length ?? -2),
      strictEqual: accessKey === providedKey,
      trimmedEqual:
        accessKey?.trim() === providedKey?.trim(),
      envHasWhitespace:
        accessKey ? accessKey !== accessKey.trim() : null,
      queryHasWhitespace:
        providedKey ? providedKey !== providedKey.trim() : null,
    });
  }

  if (!isAuthorized(searchParams.key)) {
    notFound();
  }

  const { rows, error } = await fetchRecentEvents();

  return (
    <main style={{ padding: "24px", fontFamily: "monospace", fontSize: "13px" }}>
      <h1 style={{ fontSize: "16px", marginBottom: "4px" }}>Observation Console — Events</h1>
      <p style={{ color: "#666", marginBottom: "16px" }}>
        Read-only. Internal verification only. Newest {ROW_LIMIT} shown.
      </p>

      {error && <p style={{ color: "#b00020" }}>{error}</p>}

      {!error && rows.length === 0 && <p>No events recorded yet.</p>}

      {!error && rows.length > 0 && (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Timestamp", "Session ID", "First Input", "Turn Count", "Reflection Completed", "Feedback"].map(
                (heading) => (
                  <th
                    key={heading}
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #ccc",
                      padding: "6px 10px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                  {row.timestamp instanceof Date
                    ? row.timestamp.toISOString()
                    : String(row.timestamp)}
                </td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                  {row.session_id}
                </td>
                <td
                  style={{
                    padding: "6px 10px",
                    borderBottom: "1px solid #eee",
                    whiteSpace: "pre-wrap",
                    maxWidth: "480px",
                  }}
                >
                  {row.first_input}
                </td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee" }}>{row.turn_count}</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee" }}>
                  {row.reflection_completed ? "Yes" : "No"}
                </td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee", whiteSpace: "pre-wrap" }}>
                  {row.feedback ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
