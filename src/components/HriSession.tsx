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
import ConversationCanvas from "./hri/v4/ConversationCanvas";
import ThinkingDots from "./ThinkingDots"
import { callEngine } from "@/lib/api"
type Turn = number
import RuntimePanel from "./RuntimePanel"
import Stage from "./hri/v4/Stage";
import AurinaHeader from "./hri/v4/AurinaHeader";
import ObservationWorkspace from "./hri/v4/ObservationWorkspace";

import type {
  AurinaState,
  GuideItem,
  ObservationData,
  TimelineEntry,
} from "./hri/v3/types"

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
  // For fade-in: we key the active question so CSS re-triggers on change
  const [questionKey, setQuestionKey] = useState(0)

  const turn = allInputs.length as Turn

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (rawText?: string) => {
  const text = (rawText ?? inputValue).trim()
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
 // -----------------------------
// V3 UI Adapter
// -----------------------------

const aurinaState: AurinaState =
  phase === "thinking"
    ? "resonating"
    : phase === "done"
      ? "reflecting"
      : "observing"

const entries: TimelineEntry[] = history.flatMap((item) => {
  const timelineItems: TimelineEntry[] = [
    {
      kind: "mine",
      text: item.userText,
    },
  ]

  if (item.hriResponse) {
    timelineItems.push({
      kind: "ask",
      text: item.hriResponse,
    })
  }

  return timelineItems
})

const observation: ObservationData = reflection
  ? {
      core: reflection,
    }
  : {}

const guideItems: GuideItem[] = [
  {
    id: "start",
    chip: "01",
    title: "지금 떠오르는 것을 적어보세요.",
    body: "정리하려 하지 말고 현재 마음에 나타나는 것부터 시작합니다.",
  },
  {
    id: "respond",
    chip: "02",
    title: "이어지는 질문에 자연스럽게 답해보세요.",
    body: "정답을 찾기보다 지금 느끼고 생각하는 방향을 따라갑니다.",
  },
  {
    id: "observe",
    chip: "03",
    title: "마지막에 비치는 흐름을 살펴보세요.",
    body: "HRI는 평가나 진단이 아니라 현재 리듬을 관찰하도록 돕습니다.",
  },
]

const aurinaVoice =
  phase === "thinking"
    ? "지금의 흐름을 함께 살펴보고 있습니다."
    : phase === "done"
      ? "지금 당신에게 비친 흐름입니다."
      : phase === "question"
        ? "이어지는 질문을 천천히 살펴보세요."
        : "지금 떠오르는 것부터 시작해 보세요."

const pattern: string | null = null

const NOT_YET_CLEAR = "아직 드러나지 않았습니다."

const EMERGING_PREVIEW_LIMIT = 48
const emergingPreview = observation.core
  ? observation.core.length > EMERGING_PREVIEW_LIMIT
    ? `${observation.core.slice(0, EMERGING_PREVIEW_LIMIT)}…`
    : observation.core
  : NOT_YET_CLEAR

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
  <>
    <Stage state={aurinaState} voice={aurinaVoice}>
      <AurinaHeader voice={aurinaVoice} />

      <ObservationWorkspace
        present={NOT_YET_CLEAR}
        rhythm={NOT_YET_CLEAR}
        emerging={emergingPreview}
      />

      <ConversationCanvas
        history={history}
        mainQuestion={mainQuestion}
        inputValue={inputValue}
        phase={phase}
        onInputChange={setInputValue}
        onSubmit={handleSubmit}
      />
    </Stage>

    <div className="page-shell">
 
     
  {/* ── Past exchanges ── */}

     

        {/* ── Past exchanges ──────────────────────────────────────
            Each exchange recedes into the past.
            User text: left-bordered, full weight.
            HRI past question: quieter, smaller, below.
        ─────────────────────────────────────────────────────── */}
        

        {/* ── Thinking: quiet dots, no urgency ── */}
        {phase === "thinking" && <ThinkingDots />}

        {/* ── Error ── */}
        {/* ── Error ── */}
        {error && (
          <p className="error-msg fade-in" role="alert">
            {error}
          </p>
        )}

        <button
          className="restart-btn"
          onClick={handleRestart}
          type="button"
        >
          새로 시작
        </button>






        <div
          className="bottom-panels"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.12fr 1fr',
            gap: 16,
            width: '100%',
            maxWidth: 1280,
            margin: '0 auto',
            alignItems: 'stretch',
          }}
        >
          {/* LEFT · AURINA (기존 영상 유지) */}
          <section style={{ height: '100%', minHeight: 520, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', background: '#fff', border: '0.5px solid #E2E4E7', borderRadius: 12, padding: 16 }}>
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
          <section style={{ height: '100%', minHeight: 520, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', background: '#fff', border: '0.5px solid #E2E4E7', borderRadius: 12, padding: 16 }}>
            {phase === "done" && (
              <div
                aria-live="polite"
                role="region"
                aria-label="흐름 요약"
                style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #EBEDF0' }}
              >
                <h3 style={{ fontWeight: 800, color: '#16345F', fontSize: 13, letterSpacing: 0.3, margin: 0 }}>흐름 요약</h3>
                <p style={{ color: '#3a3f47', fontSize: 13, lineHeight: 1.6, margin: '8px 0 0' }}>{reflection}</p>
              </div>
            )}
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

          
        <RuntimePanel />

    </div>
    </div>
      </>
  
  )
  } 

