import { useEffect, useRef, useState } from "react";
import HriInput from "../HriInput";
import Arrival from "./Arrival";
import Reflection from "./Reflection";
import { AURINA_ASSETS } from "./assets";
import type { Notice } from "@/lib/notice/types";
import type { Locale } from "@/lib/hri/locale";
import { CONTENT } from "@/lib/i18n/content";
import "./aurina.css";

type Exchange = {
  userText: string;
  hriResponse: string;
};

type Props = {
  phase: string;
  voice: string;
  history: Exchange[];
  mainQuestion: string | null;
  reflection: string | null;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: (rawText?: string) => void;
  onRestart: () => void;
  notices: Notice[];
  hasHistory: boolean;
  hasFinal: boolean;
  onGoHome: () => void;
  onViewHistory: () => void;
  onViewFinal: () => void;
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
};

const TRAIL_VISIBLE_COUNT = 3;

// AURINA's presence — what she is doing, not just what the app is
// doing. Derived entirely from props HriSession already computes
// (phase, inputValue); the one addition is a brief local "just
// understood" flag so the moment a reflection arrives gets a held,
// silent beat (Presence) before settling into Reflection. Purely a
// display-timing detail — no engine/controller state is involved.
type Presence = "greeting" | "waiting" | "listening" | "thinking" | "presence" | "reflection";
const PRESENCE_HOLD_MS = 750;

// The real engine (a local synchronous rule engine, no network/LLM
// call) can resolve in well under 50ms — far too fast for Thinking's
// animation to ever be perceived. This does not delay the engine or
// the result in any way: the moment `phase` actually changes, the
// real value is already sitting in the incoming props. It only holds
// the *displayed* transition out of "thinking" until a minimum time
// has passed, so a state the user is meant to notice is not skipped
// entirely. If the engine takes longer than the minimum on its own,
// this never adds any wait at all — the result is shown immediately.
const MIN_THINKING_DISPLAY_MS = 500;

type DisplaySnapshot = {
  phase: string;
  mainQuestion: string | null;
  reflection: string | null;
};

// Holds phase, mainQuestion, and reflection together as one atomic
// snapshot. This matters because mainQuestion/reflection update in
// the same synchronous state batch as phase the instant the engine
// responds — if only phase were delayed, the new question text could
// appear on screen while the "AURINA가 흐름을 살펴보고 있습니다…" line
// still showed underneath it, contradicting itself. Entering
// "thinking" is never delayed, only leaving it is; whatever was on
// screen before stays put until the minimum hold elapses.
function useDisplayState(
  phase: string,
  mainQuestion: string | null,
  reflection: string | null,
): DisplaySnapshot {
  const [display, setDisplay] = useState<DisplaySnapshot>({ phase, mainQuestion, reflection });
  const displayPhaseRef = useRef(display.phase);
  displayPhaseRef.current = display.phase;
  const enteredThinkingAt = useRef<number | null>(null);

  useEffect(() => {
    if (phase === "thinking") {
      enteredThinkingAt.current = Date.now();
      setDisplay((prev) => ({ ...prev, phase: "thinking" }));
      return;
    }

    const reveal = () => setDisplay({ phase, mainQuestion, reflection });

    if (displayPhaseRef.current === "thinking" && enteredThinkingAt.current !== null) {
      const remaining = MIN_THINKING_DISPLAY_MS - (Date.now() - enteredThinkingAt.current);
      if (remaining > 0) {
        const timer = setTimeout(reveal, remaining);
        return () => clearTimeout(timer);
      }
    }

    reveal();
  }, [phase, mainQuestion, reflection]);

  return display;
}

function usePresence(phase: string, inputValue: string): Presence {
  const [justUnderstood, setJustUnderstood] = useState(false);
  const prevPhase = useRef(phase);

  useEffect(() => {
    const wasThinking = prevPhase.current === "thinking";
    prevPhase.current = phase;

    if (wasThinking && phase === "done") {
      setJustUnderstood(true);
      const timer = setTimeout(() => setJustUnderstood(false), PRESENCE_HOLD_MS);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  if (phase === "idle") return "greeting";
  if (phase === "thinking") return "thinking";
  if (phase === "done") return justUnderstood ? "presence" : "reflection";
  return inputValue.trim() ? "listening" : "waiting";
}

/**
 * The room. One moment on screen at a time — greeting, question,
 * thinking, or final reflection — under a small persistent identity
 * anchor. Presentation only: every value here is a prop already
 * computed by HriSession's state machine.
 */
export default function AurinaSpace({
  phase,
  voice,
  history,
  mainQuestion,
  reflection,
  inputValue,
  onInputChange,
  onSubmit,
  onRestart,
  notices,
  hasHistory,
  hasFinal,
  onGoHome,
  onViewHistory,
  onViewFinal,
  locale,
  onLocaleChange,
}: Props) {
  const t = CONTENT[locale];
  const [trailExpanded, setTrailExpanded] = useState(false);
  const display = useDisplayState(phase, mainQuestion, reflection);
  const displayPhase = display.phase;
  const presence = usePresence(displayPhase, inputValue);

  // Restart clears history but this component stays mounted — without
  // this, an expanded trail from a prior session would carry over into
  // the next one instead of starting collapsed like a fresh session does.
  useEffect(() => {
    if (history.length === 0) setTrailExpanded(false);
  }, [history.length]);

  const isIdle = displayPhase === "idle";
  const isActive = displayPhase === "question" || displayPhase === "thinking";
  const isDone = displayPhase === "done";

  const hiddenCount = history.length - TRAIL_VISIBLE_COUNT;
  const visibleHistory =
    trailExpanded || hiddenCount <= 0 ? history : history.slice(-TRAIL_VISIBLE_COUNT);

  return (
    <div className="aurina-space">
      {/* Arrival and Reflection each bring their own full brand header —
          the small persistent anchor is for Conversation only, to avoid
          duplicate branding elsewhere. */}
      {isActive && (
        <div className="aurina-identity">
          <div className="aurina-portrait" data-presence={presence}>
            <div className="aurina-mirror-wave" aria-hidden="true" />
            <img src={AURINA_ASSETS.identityImage} alt="AURINA" />
          </div>
          <div className="aurina-name">AURINA</div>
        </div>
      )}

      <div className="aurina-moment" key={displayPhase}>
        {isIdle && (
          <Arrival
            inputValue={inputValue}
            onInputChange={onInputChange}
            onSubmit={onSubmit}
            notices={notices}
            hasHistory={hasHistory}
            hasFinal={hasFinal}
            onViewHistory={onViewHistory}
            onViewFinal={onViewFinal}
            onRestart={onRestart}
            locale={locale}
            onLocaleChange={onLocaleChange}
          />
        )}

        {isActive && (
          <>
            <div className="aurina-utility-row">
              <button type="button" className="aurina-utility-link" onClick={onGoHome}>
                {t.conversation.home}
              </button>
              {hasFinal && (
                <button type="button" className="aurina-utility-link" onClick={onViewFinal}>
                  {t.conversation.viewFinal}
                </button>
              )}
              <button type="button" className="aurina-utility-link aurina-utility-link--muted" onClick={onRestart}>
                {t.conversation.restart}
              </button>
            </div>

            {history.length > 0 && (
              <div className="aurina-trail" aria-label={t.conversation.prevConversationAria}>
                {hiddenCount > 0 && !trailExpanded && (
                  <button
                    type="button"
                    className="aurina-trail-toggle"
                    onClick={() => setTrailExpanded(true)}
                  >
                    {t.conversation.showMore(hiddenCount)}
                  </button>
                )}

                {visibleHistory.map((exchange, index) => (
                  <div key={`${exchange.userText}-${index}`} className="aurina-trail-item">
                    <p className="aurina-trail-user">{exchange.userText}</p>
                    {exchange.hriResponse && (
                      <p className="aurina-trail-aurina">{exchange.hriResponse}</p>
                    )}
                  </div>
                ))}

                {trailExpanded && hiddenCount > 0 && (
                  <button
                    type="button"
                    className="aurina-trail-toggle"
                    onClick={() => setTrailExpanded(false)}
                  >
                    {t.conversation.collapse}
                  </button>
                )}
              </div>
            )}

            {displayPhase !== "thinking" && display.mainQuestion && (
              <div className="aurina-conversation-zone" aria-live="polite">
                {history.length > 0 && (
                  <div className="aurina-mine-block">
                    <div className="aurina-mine-label">{t.conversation.myStory}</div>
                    <p className="aurina-mine-text">{history[history.length - 1]?.userText}</p>
                  </div>
                )}
                <div className="aurina-question-label">AURINA</div>
                <p className="aurina-question-text">{display.mainQuestion}</p>
              </div>
            )}

            {displayPhase === "thinking" ? (
              <p className="aurina-thinking">{t.conversation.thinking}</p>
            ) : (
              <div className="aurina-input-zone">
                <HriInput
                  value={inputValue}
                  onChange={onInputChange}
                  onSubmit={onSubmit}
                  placeholder={t.conversation.inputPlaceholder}
                  autoFocus
                  locale={locale}
                />
              </div>
            )}
          </>
        )}

        {isDone && (
          <>
            <Reflection
              reflection={display.reflection}
              onRestart={onRestart}
              hasHistory={hasHistory}
              onViewHistory={onViewHistory}
              onGoHome={onGoHome}
              locale={locale}
            />
            {/* Gate 18 — Reflection is a Mirror Snapshot, not
                Conversation End: the input stays available underneath
                it so the user can keep adding evidence and receive an
                updated Reflection, without conflating that with
                Restart (onRestart above, unchanged, still resets the
                whole session). Same HriInput used everywhere else —
                no new input component.
                Release UI Cleanup — given its own labeled section
                (border-top + caption, muted gray vs. the reflection
                layers' gold) so it doesn't read as an appendage to the
                restart button above it; placeholder shortened since
                the caption above it already carries that context. */}
            <div className="aurina-continuation">
              <h2 className="aurina-continuation-title">{t.conversation.continuationTitle}</h2>
              <div className="aurina-input-zone aurina-input-zone--continuation">
                <HriInput
                  value={inputValue}
                  onChange={onInputChange}
                  onSubmit={onSubmit}
                  placeholder={t.conversation.continuationPlaceholder}
                  locale={locale}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
