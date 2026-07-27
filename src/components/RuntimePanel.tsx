// Placeholder container — reserved for future engine runtime metrics.
// Intentionally renders no content: no invented numbers, no "not available"
// messaging. Layout/sizing preserved so the bottom-panels grid is unaffected.
export default function RuntimePanel() {
  return (
    <section
      style={{
        height: "100%",
        minHeight: 520,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        border: "0.5px solid #E2E4E7",
        borderRadius: 12,
        padding: 16,
      }}
    />
  )
}

