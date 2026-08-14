"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
          잠시 문제가 발생했습니다
        </h1>
        <p style={{ color: "var(--ink-3)", marginBottom: "24px" }}>
          페이지를 불러오는 중 오류가 있었습니다. 다시 시도해 주세요.
        </p>
        <button
          onClick={() => reset()}
          style={{
            border: "1px solid var(--border-strong)",
            borderRadius: "10px",
            padding: "10px 20px",
            background: "var(--bg-panel)",
            color: "var(--ink-2)",
            cursor: "pointer",
            font: "inherit",
          }}
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
