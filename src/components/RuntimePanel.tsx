// import "@/styles/runtime.css"

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
    width: "320px",
    marginTop: "0px",
        background: "linear-gradient(180deg, #050505 0%, #0b0b0b 100%)",
        border: "2px solid rgba(255,255,255,0.12)",
        boxShadow: "0 12px 36px rgba(0,0,0,0.35)",
        borderRadius: "20px",
        minHeight: "260px",
        padding: "16px",
        color: "#f5f5f5",
       fontFamily: "Inter, sans-serif"
      }}
    >
      <div
        style={{
         fontSize: "10px",                                      
          opacity: 0.92,
          marginBottom: "12px",
        }}
      >
       CURRENT RHYTHM
      </div>

     <div
        style={{
          lineHeight: 2.0,
          fontSize: "13px",
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
  ? "what once passed by is staying longer now"
  : state === "STABLE"
  ? "familiar patterns are becoming clearer"
  : state === "RECOVERING"
  ? "new rhythms are beginning to emerge"
  : state === "PRESSURED"
  ? "attention is narrowing under pressure"
  : "life is still in progress"
    
}
     </div>
    


      </section>
      )
      }

