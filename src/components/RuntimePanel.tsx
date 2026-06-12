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
      <div
  style={{
    background: "#ffffff",
    border: "1px solid #1d3557",
    borderRadius: "24px",
    padding: "24px",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start"
  }}
>
  <h3
    style={{
      marginBottom: "16px",
      color: "#0f2747",
      fontSize: "24px",
      fontWeight: 700
    }}
  >
    DR. KIM'S OBSERVATION
  </h3>

  <p
    style={{
      color: "#23395d",
      fontSize: "16px",
      lineHeight: 1.8
    }}
  >
    Your rhythm appears to be maintaining continuity.
    <br />
    현재의 흐름은 끊어지지 않고 이어지고 있습니다.
  </p>
</div>
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

