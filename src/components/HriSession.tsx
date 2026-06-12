"use client"
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
import HriInput     from "./HriInput"
import ThinkingDots from "./ThinkingDots"
import { callEngine } from "@/lib/api"
type Turn = number
import RuntimePanel from "./RuntimePanel"

// ── Types ──────────────────────────────────────────────────────────

interface Exchange {
  userText:    string
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
  const [phase,      setPhase]      = useState<Phase>("idle")
  const [inputValue, setInputValue] = useState("")
  const [history,    setHistory]    = useState<Exchange[]>([])
  const [allInputs,  setAllInputs]  = useState<string[]>([])
  const [activeQ,    setActiveQ]    = useState<string | null>(null)
  const [reflection, setReflection] = useState<string | null>(null)
  const [mainQuestion, setMainQuestion] = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)
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
    const nextTurn   = nextInputs.length as Turn

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
        setMainQuestion(nextMainQuestion || null)
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
  return (
    <div className="page-shell">

      {/* ── Header ── */}
      <header className="hri-header">
        {/* Plain <img> — no Next/Image dimension requirements.
            File must be at: public/assets/header.png           */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/header.png"
          alt="HRI — Human Rhythm Intelligence"
          className="header-image"
        />
      </header>

      {/* ── Main column ── */}
      <main className="hri-main">
      
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

            <button
              className="restart-btn"
              onClick={handleRestart}
              type="button"
              aria-label="새로운 흐름 시작"
            >
              다시 시작하기
            </button>
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
              placeholder={`이젠, 떠오르는 생각을 적어보세요.
            Now, write down the thoughts that come to mind.`}
              disabled={phase === "thinking"}
              autoFocus
           />
          </>
        )}

      

     


<div className="bottom-panels">

 <div className="aurina-panel">
  <h3>오리나 (AURINA)</h3>

  <video
    src="/videos/aurina-greeting.mp4"
    autoPlay
    muted
    loop
    playsInline
    style={{
      width: "100%",
      height: "260px",
      objectFit: "cover",
      borderRadius: "12px",
      marginTop: "12px"
    }}
    />
 <p
  style={{
    marginTop:"16px",
    lineHeight:"1.6",
   color: "black"
  }}
>
  당신 자신을 바라볼 수 있는 마음의 창입니다.
  <br />
  <span
  style={{
    fontSize:"13px",
    color: "black"
  }}
>
    A window into yourself.
  </span>
</p>
</div>
 <div className="main-panel">

  <div style={{ marginBottom: "24px" }}>
   <h3>CURRENT · 현재</h3>

<p>
  What is appearing in your life at this moment.
  <br />
  지금 삶 속에 드러나고 있는 모습입니다.
</p>
  </div>

  <hr />

  <div style={{ margin: "24px 0" }}>
    <h3>RHYTHM · 리듬</h3>



<p>
  Your rhythm is unfolding.
  <br />
  당신의 리듬이 펼쳐지고 있습니다.
</p>
  </div>

  <hr />

  <div style={{ marginTop: "24px" }}>
    <h3>DR. RICHARD KIM'S REFLECTIONS · 김 박사의 관찰</h3>

    <p
      style={{
        fontSize: "12px",
        color: "4c6283",
        marginBottom: "12px"
      }}
    >
      Founder & Developer of Human Rhythm Intelligence
    </p>

   <p>
  Reflections based on your emerging rhythm.
  <br />
  당신의 삶에 나타난 리듬을 바탕으로 한 관찰입니다.
</p>
  </div>

</div>
  <RuntimePanel
    state={runtimeState}
    confidence={confidence}
    tension={tension}
    fragmentation={fragmentation}
    elasticity={elasticity}
  />

</div>
    </main>
</div>
)
}

