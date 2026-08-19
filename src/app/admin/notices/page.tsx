import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { getNotice, listAllNotices } from "@/lib/notice/store";
import { createNoticeAction, deleteNoticeAction, togglePublishAction, updateNoticeAction } from "./actions";
import DeleteButton from "./DeleteButton";

// Notice admin — Gate §5: one page, one form, no multi-step workflow.
// Same ADMIN_ACCESS_KEY convention as /admin, /admin/observations, and
// / (see those files' own isAuthorized — duplicated here on purpose,
// same small-local-copy convention already used three times in this
// codebase rather than a shared cross-file helper for a 2-line check).
export const dynamic = "force-dynamic";

function isAuthorized(providedKey: string | undefined): boolean {
  const accessKey = process.env.ADMIN_ACCESS_KEY;
  return Boolean(accessKey) && providedKey === accessKey;
}

const inputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  maxWidth: "560px",
  padding: "8px 10px",
  marginTop: "4px",
  marginBottom: "14px",
  fontFamily: "monospace",
  fontSize: "13px",
  border: "1px solid #ccc",
  borderRadius: "4px",
  boxSizing: "border-box",
};

export default async function NoticeAdminPage({
  searchParams,
}: {
  searchParams: { key?: string; edit?: string };
}) {
  const key = searchParams.key;
  if (!isAuthorized(key)) {
    notFound();
  }
  const currentKey = key ?? "";

  const editId = searchParams.edit ? Number(searchParams.edit) : null;
  const editing = editId && Number.isInteger(editId) ? await getNotice(editId) : null;

  const { notices, error } = await listAllNotices();

  return (
    <main style={{ padding: "24px", fontFamily: "monospace", fontSize: "13px", maxWidth: "720px" }}>
      <h1 style={{ fontSize: "18px", marginBottom: "4px" }}>공지사항 관리</h1>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        <a href={`/admin?key=${encodeURIComponent(currentKey)}`}>← Operation Center</a>
      </p>

      <section style={{ marginBottom: "32px", padding: "16px", border: "1px solid #ccc", borderRadius: "6px" }}>
        <h2 style={{ fontSize: "14px", marginBottom: "12px" }}>
          {editing ? `공지 수정 — #${editing.id}` : "새 공지"}
        </h2>
        <form action={editing ? updateNoticeAction : createNoticeAction}>
          <input type="hidden" name="key" value={currentKey} />
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <label>
            제목
            <input type="text" name="title" defaultValue={editing?.title ?? ""} required style={inputStyle} />
          </label>

          <label>
            내용
            <textarea name="body" defaultValue={editing?.body ?? ""} required rows={4} style={inputStyle} />
          </label>

          <label style={{ display: "block", marginBottom: "14px" }}>
            <input type="checkbox" name="isPublished" defaultChecked={editing?.isPublished ?? false} />
            {" "}공개
          </label>

          <button
            type="submit"
            style={{ padding: "8px 20px", fontSize: "13px", border: "1px solid #333", borderRadius: "4px", background: "#333", color: "#fff", cursor: "pointer" }}
          >
            저장
          </button>
          {editing && (
            <a href={`/admin/notices?key=${encodeURIComponent(currentKey)}`} style={{ marginLeft: "12px" }}>
              취소
            </a>
          )}
        </form>
      </section>

      <section>
        <h2 style={{ fontSize: "14px", marginBottom: "12px" }}>기존 공지</h2>
        {error && <p style={{ color: "#b00020" }}>{error}</p>}
        {!error && notices.length === 0 && <p style={{ color: "#666" }}>등록된 공지가 없습니다.</p>}
        {!error && notices.map((n) => (
          <div
            key={n.id}
            style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: "1px solid #eee" }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: "bold",
                padding: "2px 8px",
                borderRadius: "999px",
                color: n.isPublished ? "#0a7d2e" : "#666",
                background: n.isPublished ? "#e6f6ea" : "#eee",
                flex: "none",
              }}
            >
              {n.isPublished ? "공개" : "비공개"}
            </span>
            <span style={{ flex: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {n.title}
            </span>
            <a href={`/admin/notices?key=${encodeURIComponent(currentKey)}&edit=${n.id}`}>수정</a>
            <form action={togglePublishAction} style={{ display: "inline" }}>
              <input type="hidden" name="key" value={currentKey} />
              <input type="hidden" name="id" value={n.id} />
              <input type="hidden" name="nextPublished" value={String(!n.isPublished)} />
              <button type="submit" style={{ background: "none", border: "none", color: "#2f4fd1", cursor: "pointer", font: "inherit", padding: 0 }}>
                {n.isPublished ? "내리기" : "공개하기"}
              </button>
            </form>
            <form action={deleteNoticeAction} style={{ display: "inline" }}>
              <input type="hidden" name="key" value={currentKey} />
              <input type="hidden" name="id" value={n.id} />
              <DeleteButton title={n.title} />
            </form>
          </div>
        ))}
      </section>
    </main>
  );
}
