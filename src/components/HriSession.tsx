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
              placeholder={`이제, 떠오르는 생각을 여기에 적어보세요.
            Now, write down the thoughts that come to mind here.`}
              disabled={phase === "thinking"}
              autoFocus
            />
          </>
        )}








        <div
          className="bottom-panels"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1.12fr 1fr', gap: 14, alignItems: 'stretch' }}
        >
          {/* LEFT · AURINA (기존 영상 유지) */}
          <section style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', border: '0.5px solid #E2E4E7', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontWeight: 800, color: '#16345F', fontSize: 15, margin: '0 0 12px' }}>오리나 (AURINA)</h3>
            {/* ⬇ 기존 <video>(또는 <img>)의 src/props를 그대로 두세요. flex:1로 높이만 채웁니다. */}
            <video
              src="/videos/aurina-greeting.mp4"
              autoPlay
              loop
              muted
              playsInline
              style={{ flex: 1, width: '100%', minHeight: 150, objectFit: 'cover', borderRadius: 8, background: '#dfe6ef' }}
            />
            <p style={{ color: '#3a3f47', fontSize: 11.5, lineHeight: 1.5, margin: '12px 0 0' }}>당신 자신을 바라볼 수 있는 마음의 창입니다.</p>
            <p style={{ color: '#9aa0a8', fontSize: 11, margin: '2px 0 0' }}>A window into yourself.</p>
          </section>

          {/* CENTER · CURRENT / RHYTHM / NOTICE */}
          <section style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', border: '0.5px solid #E2E4E7', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontWeight: 800, color: '#16345F', fontSize: 13, letterSpacing: 0.3, margin: 0 }}>CURRENT · 현재</h3>
            <p style={{ color: '#7e8893', fontSize: 11.5, margin: '5px 0 0' }}>What is appearing in your life at this moment.</p>
            <p style={{ color: '#3a3f47', fontSize: 11.5, margin: '2px 0 0' }}>지금 삶 속에 드러나고 있는 모습입니다.</p>

            <hr style={{ border: 'none', borderTop: '1px solid #EBEDF0', margin: '14px 0' }} />

            <h3 style={{ fontWeight: 800, color: '#16345F', fontSize: 13, letterSpacing: 0.3, margin: 0 }}>RHYTHM · 리듬</h3>
            <p style={{ color: '#7e8893', fontSize: 11.5, margin: '5px 0 0' }}>Your rhythm is unfolding.</p>
            <p style={{ color: '#3a3f47', fontSize: 11.5, margin: '2px 0 0' }}>당신의 리듬이 펼쳐지고 있습니다.</p>

            {/* NOTICE — marginTop:'auto'로 패널 바닥에 고정, 빈 공간을 채움 */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid #EBEDF0', paddingTop: 12 }}>
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
    </main >
</div >
)
}

