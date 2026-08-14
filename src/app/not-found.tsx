import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div>
        <h1 style={{ color: "var(--ink-1)", fontSize: "24px", marginBottom: "12px" }}>
          페이지를 찾을 수 없습니다
        </h1>
        <p style={{ color: "var(--ink-3)", marginBottom: "24px" }}>
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <Link href="/" style={{ color: "var(--accent)" }}>
          처음으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
