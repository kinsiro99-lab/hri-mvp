import HriSession from "@/components/HriSession";

// Operational open/closed switch for the public site, controlled by
// SITE_ACCESS_MODE. Only the exact string "closed" closes it — unset,
// "open", or any other value all mean open (fail-open on missing
// config, matching how DATABASE_URL/ADMIN_ACCESS_KEY default to
// inactive elsewhere in this app rather than breaking things).
export const dynamic = "force-dynamic";

function ClosedNotice() {
  return (
    <div className="hri-main" style={{ padding: "80px 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: "20px", marginBottom: "8px" }}>HRI is temporarily unavailable</h1>
      <p style={{ color: "#666" }}>
        지금은 잠시 서비스를 이용할 수 없습니다. 곧 다시 찾아와 주세요.
      </p>
    </div>
  );
}

// Server-only comparison — ADMIN_ACCESS_KEY never reaches the client
// bundle. Same bypass convention as /admin/observations: ?key=<value>.
function isAdminBypass(providedKey: string | undefined): boolean {
  const accessKey = process.env.ADMIN_ACCESS_KEY;
  return Boolean(accessKey) && providedKey === accessKey;
}

export default function Home({
  searchParams,
}: {
  searchParams: { key?: string };
}) {
  const siteClosed = process.env.SITE_ACCESS_MODE === "closed";

  if (siteClosed && !isAdminBypass(searchParams.key)) {
    return <ClosedNotice />;
  }

  return (
    <div className="hri-main">
      <HriSession />
    </div>
  );
}
