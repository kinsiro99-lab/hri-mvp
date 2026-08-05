import { neon } from "@neondatabase/serverless";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

// AURINA Operation Center — a single read-only operational view over
// the existing Observation Console (observation_events, ADMIN_ACCESS_KEY,
// SITE_ACCESS_MODE, /admin/observations). Not a new analytics system,
// not a new auth system — it only reads what already exists. Gated by
// the same ADMIN_ACCESS_KEY convention as /admin/observations and /.
export const dynamic = "force-dynamic";

const RECENT_LIMIT = 20;

type ObservationSummary = {
  total: number;
  completed: number;
  latestTimestamp: string | null;
};

type RecentSessionRow = {
  timestamp: string;
  first_input: string;
  turn_count: number;
  reflection_completed: boolean;
  feedback: string | null;
};

async function fetchObservationData(): Promise<{
  summary: ObservationSummary | null;
  recent: RecentSessionRow[];
  error: string | null;
}> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // Not an error — DATABASE_URL simply isn't configured yet.
    return { summary: null, recent: [], error: null };
  }

  try {
    const sql = neon(connectionString);

    const summaryRows = (await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE reflection_completed)::int AS completed,
        MAX(timestamp) AS latest
      FROM observation_events
    `) as { total: number; completed: number; latest: string | null }[];

    const recentRows = (await sql`
      SELECT timestamp, first_input, turn_count, reflection_completed, feedback
      FROM observation_events
      ORDER BY id DESC
      LIMIT ${RECENT_LIMIT}
    `) as RecentSessionRow[];

    const summaryRow = summaryRows[0];
    return {
      summary: {
        total: summaryRow?.total ?? 0,
        completed: summaryRow?.completed ?? 0,
        latestTimestamp: summaryRow?.latest ?? null,
      },
      recent: recentRows,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown query error";
    return { summary: null, recent: [], error: message };
  }
}

// Server-only comparison — ADMIN_ACCESS_KEY never reaches the client
// bundle, is never logged, and never appears in an error message.
function isAuthorized(providedKey: string | undefined): boolean {
  const accessKey = process.env.ADMIN_ACCESS_KEY;
  return Boolean(accessKey) && providedKey === accessKey;
}

function configuredLabel(value: string | undefined): string {
  return value ? "Configured" : "Not Configured";
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: "28px" }}>
      <h2 style={{ fontSize: "14px", marginBottom: "8px", borderBottom: "1px solid #ccc", paddingBottom: "4px" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

const cellStyle = { padding: "6px 10px", borderBottom: "1px solid #eee" } as const;

export default async function OperationCenterPage({
  searchParams,
}: {
  searchParams: { key?: string };
}) {
  const key = searchParams.key;
  if (!isAuthorized(key)) {
    notFound();
  }
  const currentKey = encodeURIComponent(key ?? "");

  const siteStatus = process.env.SITE_ACCESS_MODE === "closed" ? "CLOSED" : "OPEN";
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const { summary, recent, error } = await fetchObservationData();

  return (
    <main style={{ padding: "24px", fontFamily: "monospace", fontSize: "13px", maxWidth: "960px" }}>
      <h1 style={{ fontSize: "18px", marginBottom: "20px" }}>AURINA Operation Center</h1>

      <Section title="Service Status">
        <p style={{ fontSize: "15px", fontWeight: "bold" }}>{siteStatus}</p>
      </Section>

      <Section title="Observation Summary">
        {!databaseConfigured && (
          <p style={{ color: "#666" }}>DATABASE_URL is not configured — no observation data to summarize.</p>
        )}
        {databaseConfigured && error && <p style={{ color: "#b00020" }}>{error}</p>}
        {databaseConfigured && !error && summary && (
          <ul style={{ paddingLeft: "18px", margin: 0 }}>
            <li>DATABASE_URL configured: Yes</li>
            <li>Total observation rows: {summary.total}</li>
            <li>Reflection completed count: {summary.completed}</li>
            <li>Latest session timestamp: {summary.latestTimestamp ?? "—"}</li>
          </ul>
        )}
      </Section>

      <Section title="Recent Sessions (latest 20)">
        {!databaseConfigured && <p style={{ color: "#666" }}>Unavailable — DATABASE_URL is not configured.</p>}
        {databaseConfigured && error && <p style={{ color: "#b00020" }}>{error}</p>}
        {databaseConfigured && !error && recent.length === 0 && <p>No sessions recorded yet.</p>}
        {databaseConfigured && !error && recent.length > 0 && (
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {["Timestamp", "First Input", "Turn Count", "Reflection Completed", "Feedback"].map((heading) => (
                  <th
                    key={heading}
                    style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "6px 10px", whiteSpace: "nowrap" }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((row, index) => (
                <tr key={index}>
                  <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{row.timestamp}</td>
                  <td style={{ ...cellStyle, whiteSpace: "pre-wrap", maxWidth: "420px" }}>{row.first_input}</td>
                  <td style={cellStyle}>{row.turn_count}</td>
                  <td style={cellStyle}>{row.reflection_completed ? "Yes" : "No"}</td>
                  <td style={{ ...cellStyle, whiteSpace: "pre-wrap" }}>{row.feedback ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Operator Shortcuts">
        <ul style={{ paddingLeft: "18px", margin: 0 }}>
          <li>
            <a href={`/admin/observations?key=${currentKey}`}>Observation Console</a>
          </li>
          <li>
            <a href="/">Public Site</a>
          </li>
          <li>
            <a href={`/?key=${currentKey}`}>Administrator View</a>
          </li>
          <li>Vercel Project → Analytics</li>
        </ul>
      </Section>

      <Section title="Configuration Status">
        <ul style={{ paddingLeft: "18px", margin: 0 }}>
          <li>DATABASE_URL: {configuredLabel(process.env.DATABASE_URL)}</li>
          <li>ADMIN_ACCESS_KEY: {configuredLabel(process.env.ADMIN_ACCESS_KEY)}</li>
          <li>SITE_ACCESS_MODE: {configuredLabel(process.env.SITE_ACCESS_MODE)}</li>
        </ul>
      </Section>
    </main>
  );
}
