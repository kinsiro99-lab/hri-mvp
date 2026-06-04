
import "@/styles/runtime.css"

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
        marginTop: "120px",
        background: "linear-gradient(180deg, #050505 0%, #0b0b0b 100%)",
        border: "1px solid rgba(255,255,255,0.04)",
        boxShadow: "0 40px 120px rgba(0,0,0,0.45)",
        borderRadius: "32px",
        padding: "56px",
        color: "#f5f5f5",
       fontFamily: "Inter, sans-serif"
      }}
    >
      <div
        style={{
         fontSize: "15px",                                      
          opacity: 0.92,
          marginBottom: "24px",
        }}
      >
       CURRENT CONTINUITY
      </div>

     <div
        style={{
          lineHeight: 2.0,
          fontSize: "15px",
          fontWeight: 400,
          opacity: 0.82,
          letterSpacing: "0.2px"
       }}
    >
      <div>CONFIDENCE: {confidence.toFixed(3)}</div>
      <div>TENSION: {tension.toFixed(3)}</div>
      <div>FRAGMENTATION: {fragmentation.toFixed(3)}</div>
      <div>ELASTICITY: {elasticity.toFixed(3)}</div>
   </div>

      <div className="runtime-detected">
         {
  state === "UNCERTAIN"
    ? "continuity direction — unresolved"
    : state === "STABLE"
    ? "continuity direction — stabilizing"
    : state === "RECOVERING"
    ? "continuity direction — recovering"
    : state === "PRESSURED"
    ? "continuity direction — narrowing under pressure"
    : `continuity direction — ${state.toLowerCase()}`
}
     </div>

      </section>
      )
      }

