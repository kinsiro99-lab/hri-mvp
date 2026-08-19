"use client";

// The one client-side island on this otherwise fully server-rendered
// page — needed only for the native confirm() dialog Gate §1 asks for
// ("삭제는... 간단한 confirmation 1회는 허용한다"). Submits the same
// <form action={deleteNoticeAction}> as everything else; no extra
// client-side state, no fetch call of its own.
export default function DeleteButton({ title }: { title: string }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(`"${title}" 공지를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) {
          e.preventDefault();
        }
      }}
      style={{
        padding: "4px 10px",
        fontSize: "12px",
        color: "#b00020",
        border: "1px solid #b00020",
        borderRadius: "4px",
        background: "#fff",
        cursor: "pointer",
      }}
    >
      삭제
    </button>
  );
}
