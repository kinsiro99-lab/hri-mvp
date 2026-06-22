"use client";

// components/HriSession.tsx [v2 - Quiet Immersive]

// components/HriSession.tsx  [v2 — Quiet Immersive]
// 
// UX intent: the screen should feel like slow reading, slow writing.
// "I am quietly following my own state." — not "I am talking to an AI."
//
// State machine: idle → thinking → question → thinking → question → thinking → done
// Rendering rules:
//   - History recedes (past exchanges become quieter over time)
//   - Active question fades in gently, opacity only
//   - Input is always present and focused until done
//   - Reflection appears with extra breathing space

import { useState, useCallback, useEffect, useRef } from "react"
import HriInput from "./HriInput"
import ThinkingDots from "./ThinkingDots"
import { callEngine } from "@/lib/api"
type Turn = number
import RuntimePanel from "./RuntimePanel"

// ── Types ──────────────────────────────────────────────────────────

interface Exchange {
  userText: string
  hriResponse: string
}

type Phase =
  | "idle"       // turn 0: blank, waiting
  | "thinking"   // engine processing
  | "question"   // question visible, awaiting input
  | "done"       // reflection shown

// ── Helpers ────────────────────────────────────────────────────────

// Scroll input into view when keyboard opens on mobile
function scrollInputIntoView() {
  // Small delay lets keyboard finish animating before we scroll
  setTimeout(() => {
    const el = document.querySelector(".hri-input") as HTMLElement | null
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, 350)
}

// ── Component ──────────────────────────────────────────────────────

export default function HriSession() {

  const BETA_OPEN = true;
  const BETA_PASSWORD = "Mirror2026!";

  const [phase, setPhase] = useState<Phase>("idle")
  const [inputValue, setInputValue] = useState("")
  const [history, setHistory] = useState<Exchange[]>([])
  const [allInputs, setAllInputs] = useState<string[]>([])
  const [activeQ, setActiveQ] = useState<string | null>(null)
  const [reflection, setReflection] = useState<string | null>(null)
  const [mainQuestion, setMainQuestion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runtimeState, setRuntimeState] = useState("IN MOTION")
  const [confidence, setConfidence] = useState(0.714)
  const [tension, setTension] = useState(0.582)
  const [fragmentation, setFragmentation] = useState(0.291)
  const [elasticity, setElasticity] = useState(0.418)

  // For fade-in: we key the active question so CSS re-triggers on change
  const [questionKey, setQuestionKey] = useState(0)

  const turn = allInputs.length as Turn

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || phase === "thinking" || phase === "done") return

    const nextInputs = [...allInputs, text]
    const nextTurn = nextInputs.length as Turn

    setInputValue("")
    setAllInputs(nextInputs)
    setError(null)
    setPhase("thinking")

    try {
      const result = await callEngine({ turn: nextTurn, inputs: nextInputs })

      if (result.reflection) {
        const nextMainQuestion = typeof result.mainQuestion === "string"
          ? result.mainQuestion.trim()
          : ""

        setHistory(prev => [...prev, { userText: text, hriResponse: "" }])
        setActiveQ(null)
        setReflection(result.reflection)
        setMainQuestion(null)
        setPhase("done")
        return 
      }

      if (result.question) {
        setHistory(prev => [
          ...prev,
          { userText: text, hriResponse: result.question! },
        ])
        setActiveQ(result.question)
        setQuestionKey(k => k + 1)   // triggers CSS fade-in
        setPhase("question")
        return
      }

      setPhase("idle")

    } catch {
      setError("잠시 연결이 원활하지 않아요. 다시 시도해 주세요.")
      setPhase(turn === 0 ? "idle" : "question")
    }
  }, [inputValue, allInputs, phase, turn])

  // ── Restart ────────────────────────────────────────────────────
  const handleRestart = () => {
    setPhase("idle")
    setInputValue("")
    setHistory([])
    setAllInputs([])
    setActiveQ(null)
    setReflection(null)
    setMainQuestion(null)
    setError(null)
    setQuestionKey(0)
  }

  // ── Mobile: scroll input into view on focus ────────────────────
  const handleInputFocus = () => scrollInputIntoView()

  // ── Render ─────────────────────────────────────────────────────
if (!BETA_OPEN) {
  return (
    <div style={{
      padding: 80,
      textAlign: "center"
    }}>
      <h1>Beta Test Closed</h1>
      <p>베타 테스트가 종료되었습니다.</p>
    </div>
  );
}
  return (
  <div className="page-shell">
 <section
  className="hero-zone"
  style={{
    display: "grid",
    gridTemplateColumns: "620px 420px",
    gap: "40px",
    alignItems: "center",
    maxWidth: "1120px",
    margin: "0 auto",
    padding: "24px 36px"
  }}
>
  <div
  className="hero-left"
  style={{
    minWidth: "560px"
  }}
>

 <div
  style={{
    fontSize: "120px",
    fontWeight: 900,
    color: "#061A44",
    lineHeight: 0.95,
    letterSpacing: "-0.03em"
  }}
>
  AURINA
</div>

<div
  style={{
    fontSize: "28px",
    fontWeight: 600,
    color: "#35527A",
    marginTop: "12px"
  }}
>
  마음의 거울
Mirror of Mind
</div>

<div className="hero-slogan" style={{ fontSize: "28px", fontWeight: 800, color: "#061A44", lineHeight: 1.35, marginTop: "18px" }}>
  당신의 마음을 비추고,
  지금의 흐름을 보세요.
</div>

<div className="hero-tech" style={{ fontSize: "18px", fontWeight: 700, color: "#061A44", marginTop: "14px" }}>
  Human Rhythm Intelligence
</div>

<div className="hero-slogan-ko" style={{ fontSize: "24px", fontWeight: 800, color: "#061A44", lineHeight: 1.5, marginTop: "16px" }}>
 AURINA는 당신의 마음을 비추는 거울입니다.
</div>

</div>

<div
  className="hero-right"
  style={{
 width: "430px",
 justifySelf: "end",
}}
>
  
  <video
    autoPlay
    muted
    loop
    playsInline
    style={{
  width: "100%",
  maxWidth: 620,
  height: 390,
  objectFit: "contain",
  objectPosition: "center top",
  borderRadius: "24px",
  background: "#f4f6fa"
}}
  >
    <source src="/videos/aurina-greeting.mp4" type="video/mp4" />
  </video>
</div>
       </section>
     
  {/* ── Past exchanges ── */}

     

        {/* ── Past exchanges ──────────────────────────────────────
            Each exchange recedes into the past.
            User text: left-bordered, full weight.
            HRI past question: quieter, smaller, below.
        ─────────────────────────────────────────────────────── */}
        {history.length > 0 && (
          <div className="history-area" aria-label="이전 흐름">
            {history.map((ex, i) => (
              <div className="exchange" key={i}>
                <p className="user-entry">{ex.userText}</p>
                {ex.hriResponse && (
                  <p className="hri-response">{ex.hriResponse}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Thinking: quiet dots, no urgency ── */}
        {phase === "thinking" && <ThinkingDots />}

        {/* ── Reflection: afterimage, not output ──────────────────
            Fades in slowly. More space than any other element.
            Does not look like a card, widget, or AI response.
        ─────────────────────────────────────────────────────── */}
        {phase === "done" && reflection && (
          <div
            className="reflection-block"
            aria-live="polite"
            role="region"
            aria-label="흐름 요약"
          >
            <span className="reflection-label">흐름 요약</span>
            <p className="reflection-text">{reflection}</p>

            {mainQuestion && (
              <section
                className="main-question-block"
                aria-live="polite"
                aria-label="다음 질문"
              >
                <span className="main-question-label">다음 질문</span>
                <p className="main-question-text">{mainQuestion}</p>
              </section>
            )}

           
          </div>
        )}


        {/* ── Error ── */}
        {error && (
          <p className="error-msg fade-in" role="alert">
            {error}
          </p>
        )}

        {/* ── Input: always present, always focused ───────────────
            The product IS this textarea.
            Everything above exists only to give it context.
        ─────────────────────────────────────────────────────── */}
        {phase !== "done" && (
          <>

            <HriInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleSubmit}
              placeholder={`
                   지금 떠오르는 것을 적어보세요. · What is present in you right now?
          `}
              disabled={phase === "thinking"}
              autoFocus
            />
          </>
        )}
        <div style={{
          textAlign: "center",
          color: "#6b7280",
          fontSize: "14px",
          lineHeight: 1.8,
          marginTop: "16px"
        }}>
        
        </div>
        <button
          className="restart-btn"
          onClick={handleRestart}
          type="button"
        >
          새로 시작
        </button>






        <div
          className="bottom-panels"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1.12fr 1fr', gap: 14, alignItems: 'stretch' }}
        >
          {/* LEFT · AURINA (기존 영상 유지) */}
          <section style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', border: '0.5px solid #E2E4E7', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontWeight: 800, color: '#16345F', fontSize: 15, margin: '0 0 12px' }}>오리나 (AURINA)</h3>
            {/* ⬇ 기존 <video>(또는 <img>)의 src/props를 그대로 두세요. flex:1로 높이만 채웁니다. */}
            <img
              src="/aurina-blue.png"
              alt="AURINA"
              style={{
                width: 180,
                height: 220,
                objectFit: 'cover',
                borderRadius: 8,
                alignSelf: 'center'
              }}
            />
            <p style={{ color: '#061A44', fontSize: 14, fontWeight: 800, lineHeight: 1.5, margin: '16px 0 0' }}>
              당신의 마음을 비추는 거울입니다.
            </p>
            <p style={{ color:'#35527A', fontSize:13, margin:'4px 0' }}>
              A mirror for your inner rhythm.
           </p>

           <hr />

             <h4>사용 방법</h4>

            <p>1. 지금 떠오르는 것을 적어보세요.</p>

            <p>2. 질문에 자연스럽게 답해보세요.</p>

            <p>3. 무엇이 보이는지 살펴보세요.</p>
            <div style={{ textAlign: 'center' }}></div>
          </section>

          {/* CENTER · CURRENT / RHYTHM / NOTICE */}
          <section style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', border: '0.5px solid #E2E4E7', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontWeight: 800, color: '#16345F', fontSize: 13, letterSpacing: 0.3, margin: 0 }}>CURRENT · 현재</h3>
            <p style={{ color: '#7e8893', fontSize: 11.5, margin: '5px 0 0' }}>What is appearing in your life at this moment.</p>
            <p style={{ color: '#3a3f47', fontSize: 11.5, margin: '2px 0 0' }}>지금 삶 속에 드러나고 있는 모습입니다.</p>

            <hr style={{ border: 'none', borderTop: '1px solid #EBEDF0', margin: '14px 0' }} />

            <h3 style={{ fontWeight: 800, color: '#16345F', fontSize: 13, letterSpacing: 0.3, margin: 0 }}>RHYTHM · 리듬</h3>
            <p style={{ color: '#7e8893', fontSize: 11.5, margin: '5px 0 0' }}>Your mind is being reflected.</p>
            <p style={{ color: '#3a3f47', fontSize: 11.5, margin: '2px 0 0' }}>당신의 마음이 비춰지고 있습니다.</p>
            <hr style={{ border: "none", borderTop: "1px solid #EBEDF0", margin: "14px 0" }} />

            <h3 style={{ fontWeight: 800, color: "#16345F", fontSize: 13, letterSpacing: 0.3, margin: 0 }}>
            MIRROR · 마음의 거울
           </h3>

            <p style={{ color: "#7e8893", fontSize: 11.5, margin: "5px 0 0" }}>
            What is your mind reflecting right now?
           </p>

           <p style={{ color: "#3a3f47", fontSize: 11.5, margin: "2px 0 0" }}>
            지금 당신의 마음은 무엇을 비추고 있습니까?
           </p>
            <hr style={{ border: 'none', borderTop: '1px solid #EBEDF0', margin: '14px 0' }} />

           <p style={{ color: '#7e8893', fontSize: 11.5, margin: '5px 0 0' }}>
            What is your mind reflecting now?
           </p>

           <p style={{ color: '#3a3f47', fontSize: 11.5, margin: '2px 0 0' }}>
            지금 당신의 마음은 무엇을 비추고 있나요?
           </p>
            {/* NOTICE — marginTop:'auto'로 패널 바닥에 고정, 빈 공간을 채움 */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid #EBEDF0', paddingTop: 20 }}>
              <h4 style={{ fontWeight: 700, color: '#9aa0a8', fontSize: 11, letterSpacing: 0.4, margin: 0 }}>NOTICE · 공지사항</h4>
              <p style={{ color: '#5a606a', fontSize: 11, lineHeight: 1.5, margin: '5px 0 0' }}>
                HRI는 평가나 진단을 위한 도구가 아닙니다.<br />
                현재 삶에 나타나는 생각과 흐름을 통해 당신의 리듬을 관찰할 수 있도록 돕습니다.
              </p>
            </div>
          </section>

          
        <RuntimePanel
          state={runtimeState}
          confidence={confidence}
          tension={tension}
          fragmentation={fragmentation}
          elasticity={elasticity}
        />

    </div>
    </div>
  )
  } 

