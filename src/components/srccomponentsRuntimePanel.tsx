"use client"

interface RuntimePanelProps {
  state: string
  confidence: number
  tension: number
  fragmentation: number
  elasticity: number
}

export default function RuntimePanel({
  state,
  confidence,
  tension,
  fragmentation,
  elasticity,
}: RuntimePanelProps) {
  return (
    <section
      style={{
        marginTop: "48px",
        background: "#050505",
        border: "1px solid #222",
        borderRadius: "24px",
        padding: "32px",
        color: "#fff",
        fontFamily: "monospace",
      }}
    >
      <div style={{ fontSize: "14px", opacity: 0.7 }}>
        RUNTIME ANALYSIS
      </div>

      <div style={{ marginTop: "24px", lineHeight: 1.9 }}>
        <div>STATE: {state}</div>
        <div>CONFIDENCE: {confidence.toFixed(3)}</div>
        <div>TENSION: {tension.toFixed(3)}</div>
        <div>FRAGMENTATION: {fragmentation.toFixed(3)}</div>
        <div>ELASTICITY: {elasticity.toFixed(3)}</div>
      </div>

      <div
        style={{
          marginTop: "40px",
          fontSize: "56px",
          fontWeight: 300,
          letterSpacing: "-2px",
        }}
      >
        {state} state detected.
      </div>
    </section>
  )
}
