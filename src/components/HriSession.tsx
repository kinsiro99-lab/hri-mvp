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
import ThinkingDots from "./ThinkingDots"
import { callEngine } from "@/lib/api"
type Turn = number
import AurinaSpace from "./aurina/AurinaSpace";
import Workspace from "./aurina/Workspace";

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
        setMainQuestion(result.question)
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
    <main className="aurina-page" data-state={aurinaState}>
      <AurinaSpace
        phase={phase}
        voice={aurinaVoice}
        history={history}
        mainQuestion={mainQuestion}
        reflection={reflection}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSubmit={handleSubmit}
      />

      {phase === "thinking" && <ThinkingDots />}

      {error && (
        <p className="aurina-error" role="alert">
          {error}
        </p>
      )}

      <Workspace onRestart={handleRestart} />
    </main>
  )
  }

