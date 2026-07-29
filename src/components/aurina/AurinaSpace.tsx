import { useEffect, useRef, useState } from "react";
import HriInput from "../HriInput";
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
}: Props) {
  const [trailExpanded, setTrailExpanded] = useState(false);
  const display = useDisplayState(phase, mainQuestion, reflection);
  const displayPhase = display.phase;
  const presence = usePresence(displayPhase, inputValue);

  const isIdle = displayPhase === "idle";
  const isActive = displayPhase === "question" || displayPhase === "thinking";
  const isDone = displayPhase === "done";

  const hiddenCount = history.length - TRAIL_VISIBLE_COUNT;
  const visibleHistory =
    trailExpanded || hiddenCount <= 0 ? history : history.slice(-TRAIL_VISIBLE_COUNT);

  return (
    <div className="aurina-space">
      <div className="aurina-identity">
        <div className="aurina-portrait" data-presence={presence}>
          <div className="aurina-mirror-wave" aria-hidden="true" />
          <video autoPlay muted loop playsInline>
            <source src="/videos/aurina-greeting.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="aurina-name">AURINA</div>
      </div>

      <div className="aurina-moment" key={displayPhase}>
        {isIdle && (
          <>
            <div className="aurina-eyebrow">HUMAN RHYTHM INTELLIGENCE</div>
            <p className="aurina-voice">{voice}</p>
            <div className="aurina-input-zone">
              <HriInput
                value={inputValue}
                onChange={onInputChange}
                onSubmit={onSubmit}
                placeholder="지금 떠오르는 것을 적어보세요."
                autoFocus
              />
            </div>
          </>
        )}

        {isActive && (
          <>
            {history.length > 0 && (
              <div className="aurina-trail" aria-label="이전 답변">
                {hiddenCount > 0 && !trailExpanded && (
                  <button
                    type="button"
                    className="aurina-trail-toggle"
                    onClick={() => setTrailExpanded(true)}
                  >
                    이전 답변 더보기 ({hiddenCount})
                  </button>
                )}

                {visibleHistory.map((exchange, index) => (
                  <div key={`${exchange.userText}-${index}`} className="aurina-trail-item">
                    {exchange.userText}
                  </div>
                ))}

                {trailExpanded && hiddenCount > 0 && (
                  <button
                    type="button"
                    className="aurina-trail-toggle"
                    onClick={() => setTrailExpanded(false)}
                  >
                    접기
                  </button>
                )}
              </div>
            )}

            {display.mainQuestion && (
              <div aria-live="polite">
                <div className="aurina-question-label">AURINA</div>
                <p className="aurina-question-text">{display.mainQuestion}</p>
              </div>
            )}

            {displayPhase === "thinking" ? (
              <p className="aurina-thinking">AURINA가 흐름을 살펴보고 있습니다…</p>
            ) : (
              <div className="aurina-input-zone">
                <HriInput
                  value={inputValue}
                  onChange={onInputChange}
                  onSubmit={onSubmit}
                  placeholder="지금 떠오르는 것을 적어보세요."
                  autoFocus
                />
              </div>
            )}
          </>
        )}

        {isDone && (
          <p className="aurina-reflection" aria-live="polite">
            {display.reflection}
          </p>
        )}
      </div>
    </div>
  );
}
