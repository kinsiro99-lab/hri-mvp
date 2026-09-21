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
import { callEngine, logObservationEvent } from "@/lib/api"
type Turn = number
import AurinaSpace from "./aurina/AurinaSpace";

import type {
  AurinaState,
  GuideItem,
  ObservationData,
  TimelineEntry,
} from "./hri/v3/types"
import type { Notice } from "@/lib/notice/types"
import type { UiLocale } from "@/lib/hri/locale"
import { toEngineLocale } from "@/lib/hri/locale"
import type { HriEvent, SessionState } from "@/lib/hri/types"
import { CONTENT } from "@/lib/i18n/content"

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

// One id per session (reset on restart) — the only identifier the
// Observation Console's ObservationEvent contract requires that no
// existing state in this component already tracked.
function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Draft Preservation Gate (STEP V2) — sessionStorage only, inputValue
// only. A fixed key, not sessionIdRef-scoped: sessionIdRef itself is
// regenerated on every mount (see createSessionId() above), so keying
// on it would make a reload generate a brand-new id before the old
// draft could ever be looked up under it — the exact restore this Gate
// exists to provide. sessionStorage is already scoped to one browser
// tab, so a fixed key cannot collide with another tab's draft.
const DRAFT_STORAGE_KEY = "hri-input-draft"

function readDraft(): string {
  if (typeof window === "undefined") return ""
  try {
    return window.sessionStorage.getItem(DRAFT_STORAGE_KEY) ?? ""
  } catch {
    return ""
  }
}

function writeDraft(text: string) {
  if (typeof window === "undefined") return
  try {
    if (text) {
      window.sessionStorage.setItem(DRAFT_STORAGE_KEY, text)
    } else {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY)
    }
  } catch {
    // Private-mode/quota/storage-disabled — draft preservation is a
    // convenience, never a hard requirement; fail silently.
  }
}

// ── Component ──────────────────────────────────────────────────────

export default function HriSession({ notices = [] }: { notices?: Notice[] }) {

  const BETA_OPEN = true;
  const BETA_PASSWORD = "Mirror2026!";

  const [phase, setPhase] = useState<Phase>("idle")
  const [inputValue, setInputValue] = useState("")
  const [history, setHistory] = useState<Exchange[]>([])
  const [allInputs, setAllInputs] = useState<string[]>([])
  // State Continuation Gate — the SessionState/HriEvent[] the engine
  // returned for the most recently confirmed turn. Held in ordinary
  // React state only (no localStorage/sessionStorage, per this Gate's
  // constraints) so it lives exactly as long as allInputs/history do —
  // lost on refresh today, same as every other piece of session state
  // in this component. Sent back as priorState/priorEvents so the next
  // call can advance one new turn instead of replaying the whole
  // conversation (see sessionAdapter.ts). undefined on turn 1 (and
  // after handleRestart), which is exactly the signal sessionAdapter.ts
  // reads to fall back to its original full-replay path.
  const [engineState, setEngineState] = useState<SessionState | undefined>(undefined)
  const [engineEvents, setEngineEvents] = useState<HriEvent[] | undefined>(undefined)
  // Multilingual Gate — Beta Handoff §2: locale is session-locked. Free
  // to change only while allInputs is still empty (no session data has
  // been built under a specific locale yet); handleLocaleChange below
  // guards this explicitly, and the switcher itself is only rendered
  // pre-session (Arrival, hasHistory === false) as the primary guard.
  const [locale, setLocale] = useState<UiLocale>("ko")
  const [activeQ, setActiveQ] = useState<string | null>(null)
  const [reflection, setReflection] = useState<string | null>(null)
  const [mainQuestion, setMainQuestion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // For fade-in: we key the active question so CSS re-triggers on change
  const [questionKey, setQuestionKey] = useState(0)

  const sessionIdRef = useRef<string>()
  if (!sessionIdRef.current) sessionIdRef.current = createSessionId()

  // Draft Preservation Gate (STEP V2) — restore once on mount, client
  // only. Left at the default "" for the very first render so server
  // and client markup match on hydration (no SSR value to diverge
  // from); this effect only ever runs after that, patching inputValue
  // the same way any other post-mount state update would.
  useEffect(() => {
    const draft = readDraft()
    if (draft) setInputValue(draft)
  }, [])

  // Draft Preservation Gate (STEP V2) — persist on every inputValue
  // change; emptying it (a normal submit, or the user clearing the box)
  // clears the draft the same way. skipFirstPersistRef prevents the
  // mount's own initial "" render from firing before the restore effect
  // above has a chance to run and wiping a real draft the instant it's
  // read back in.
  const skipFirstPersistRef = useRef(true)
  // Draft Preservation Gate (STEP V4 correction) — while non-null, holds
  // the exact text a submit currently in flight is protecting in
  // storage. handleSubmit clears the on-screen inputValue immediately
  // (unchanged UX), which would otherwise make this effect fire with
  // "" and erase the just-submitted text from storage before the
  // network call is even confirmed. This makes that one transition a
  // no-op instead; handleSubmit owns writing/clearing the protected
  // draft itself for the submit's whole round trip (see below).
  const pendingSubmitDraftRef = useRef<string | null>(null)
  useEffect(() => {
    if (skipFirstPersistRef.current) {
      skipFirstPersistRef.current = false
      return
    }
    if (pendingSubmitDraftRef.current !== null) return
    writeDraft(inputValue)
  }, [inputValue])

  const turn = allInputs.length as Turn

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (rawText?: string) => {
  const text = (rawText ?? inputValue).trim()
    // Gate 18 — Reflection is a Mirror Snapshot, not Conversation End:
    // "done" no longer blocks further submission (only "thinking" —
    // already-in-flight — does). allInputs/history/sessionId are
    // untouched here, so a continuation turn replays the same growing
    // input list through the same stateless engine call below; nothing
    // about server-side evidence/session identity changes. Restart
    // (handleRestart) remains the only path that resets them.
    if (!text || phase === "thinking") return

    const nextInputs = [...allInputs, text]
    const nextTurn = nextInputs.length as Turn
    // Navigation Stabilization — Restart Race Guard. sessionIdRef.current
    // is regenerated only by handleRestart() below; snapshotting it here
    // and re-checking after the network round trip lets this turn detect
    // "a restart happened while I was in flight" and refuse to apply its
    // own (now-stale) result on top of the freshly-cleared session —
    // root cause of restart appearing to leave the old conversation/
    // Final behind when it was clicked during a pending "thinking" turn.
    const submittedSessionId = sessionIdRef.current

    setInputValue("")
    // Draft Preservation Gate (STEP V4 correction) — protect the
    // submitted original text in storage across the whole network round
    // trip, independent of the on-screen input clearing above. Cleared
    // only once callEngine actually confirms success (below) or fails
    // (catch block) — never by the generic persist effect reacting to
    // this same-tick setInputValue("").
    pendingSubmitDraftRef.current = text
    writeDraft(text)
    setAllInputs(nextInputs)
    setError(null)
    setPhase("thinking")

    try {
      const result = await callEngine({
        turn: nextTurn,
        inputs: nextInputs,
        // Multilingual Localization Gate — Runtime only understands
        // ko/ja/en; a zh-CN/zh-HK/zh-TW UI locale maps to en here, at
        // this one call site, so no Runtime file needs to know about
        // the wider UiLocale at all. See toEngineLocale's own comment.
        locale: toEngineLocale(locale),
        priorState: engineState,
        priorEvents: engineEvents,
        // Question Observation Foundation Sprint 01 — same sessionId
        // already used below for logObservationEvent; mainQuestion is
        // whatever question was on screen before this submission (null
        // on the very first turn, since that answers the static
        // Landing prompt, not an HRI-generated question). Read only by
        // the API route for Observation logging.
        sessionId: sessionIdRef.current!,
        previousQuestion: mainQuestion ?? undefined,
      })

      // Restart Race Guard — a restart during this await means the
      // session on screen is no longer this turn's session; applying
      // this result now would resurrect the conversation/Final the
      // user just cleared. Storage/draft state was already handled by
      // handleRestart's own setInputValue(""); nothing further to
      // clean up here.
      if (sessionIdRef.current !== submittedSessionId) return

      // Draft Preservation Gate (STEP V4 correction) — callEngine has
      // now actually confirmed success; the protected draft has done
      // its job and is safe to clear, regardless of which branch below
      // this turn resolves into.
      pendingSubmitDraftRef.current = null
      writeDraft("")
      setEngineState(result.nextState)
      setEngineEvents(result.nextEvents)

      if (result.reflection) {
        const nextMainQuestion = typeof result.mainQuestion === "string"
          ? result.mainQuestion.trim()
          : ""

        setHistory(prev => [...prev, { userText: text, hriResponse: "" }])
        setActiveQ(null)
        setReflection(result.reflection)
        setMainQuestion(null)
        setPhase("done")
        logObservationEvent({
          sessionId: sessionIdRef.current!,
          firstInput: nextInputs[0] ?? "",
          turnCount: nextTurn,
          reflectionCompleted: true,
          feedback: null,
        })
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
      // Restart Race Guard — same reasoning as the success path above:
      // a restart during this await means this failure no longer
      // belongs to anything on screen (no error banner, no text
      // restore into a box the user just cleared via restart).
      if (sessionIdRef.current !== submittedSessionId) return
      setError(CONTENT[locale].session.networkError)
      setPhase(turn === 0 ? "idle" : "question")
      // Draft Preservation Gate (STEP V2/V4) — callEngine failed before
      // any server confirmation; restore exactly what was submitted
      // (never a reconstruction) so the network error doesn't also cost
      // the user's text. Storage already holds `text` (written at
      // submit time above, and never touched since — the pending guard
      // keeps the generic persist effect from clearing it); releasing
      // the guard here just hands storage syncing back to that effect,
      // which re-writes the same value the instant inputValue changes.
      pendingSubmitDraftRef.current = null
      setInputValue(text)
    }
  }, [inputValue, allInputs, phase, turn, locale, engineState, engineEvents])

  // ── Restart ────────────────────────────────────────────────────
  const handleRestart = () => {
    setPhase("idle")
    setInputValue("")
    setHistory([])
    setAllInputs([])
    setEngineState(undefined)
    setEngineEvents(undefined)
    setActiveQ(null)
    setReflection(null)
    setMainQuestion(null)
    setError(null)
    setQuestionKey(0)
    sessionIdRef.current = createSessionId()
  }

  // ── Locale (Multilingual Gate) ────────────────────────────────
  // Guarded here too, not just by the switcher's own visibility in
  // Arrival — Beta Handoff §2: language must never change mid-session.
  const handleLocaleChange = useCallback((next: UiLocale) => {
    if (allInputs.length > 0) return
    setLocale(next)
  }, [allInputs.length])

  // ── Non-destructive navigation ────────────────────────────────
  // Unlike handleRestart above, none of these clear allInputs/history/
  // reflection/sessionId — they only move which view `phase` renders.
  // No engine call happens here, so a returning "Final" is always the
  // exact same object already in state, never recomputed.
  const handleGoHome = useCallback(() => {
    setPhase("idle")
  }, [])

  const handleViewHistory = useCallback(() => {
    if (allInputs.length === 0) return
    setPhase("question")
  }, [allInputs.length])

  const handleViewFinal = useCallback(() => {
    if (!reflection) return
    setPhase("done")
  }, [reflection])
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
    <main className="aurina-page" data-state={aurinaState} data-phase={phase}>
      <AurinaSpace
        phase={phase}
        voice={aurinaVoice}
        history={history}
        mainQuestion={mainQuestion}
        reflection={reflection}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSubmit={handleSubmit}
        onRestart={handleRestart}
        notices={notices}
        hasHistory={allInputs.length > 0}
        hasFinal={reflection !== null}
        onGoHome={handleGoHome}
        onViewHistory={handleViewHistory}
        onViewFinal={handleViewFinal}
        locale={locale}
        onLocaleChange={allInputs.length === 0 ? handleLocaleChange : undefined}
      />

      {phase === "thinking" && <ThinkingDots />}

      {error && (
        <p className="aurina-error" role="alert">
          {error}
        </p>
      )}
    </main>
  )
  }

