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
        background: "#ffffff",
        border: "1px solid #E2E4E7",
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        borderRadius: "20px",
        minHeight: "420px",
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
    minHeight: "420px",
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
    AURINA OBSERVATION
  </h3>

  <p
    style={{
      color: "#23395d",
      fontSize: "16px",
      lineHeight: 1.8
    }}
  >
   Your mind is being reflected.
   <br />
   당신의 마음이 비춰지고 있습니다.
   <br /><br />

   Observe what appears.
   <br />
  지금 드러나는 모습을 보세요.
  </p>
</div>

    

     </div>
    


      </section>
      )
      }

