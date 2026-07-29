import { useEffect, useRef } from "react";
import HriInput from "../../HriInput";
import "./hri-v4.css";

type Exchange = {
  userText: string;
  hriResponse: string;
};

type ConversationCanvasProps = {
  history: Exchange[];
  mainQuestion: string | null;
  inputValue: string;
  phase: string;
  onInputChange: (value: string) => void;
  onSubmit: (rawText?: string) => void;
};

export default function ConversationCanvas({
  history,
  mainQuestion,
  inputValue,
  phase,
  onInputChange,
  onSubmit,
}: ConversationCanvasProps) {
  const flowRef = useRef<HTMLDivElement>(null);
  const isEmpty = history.length === 0 && !mainQuestion;

  useEffect(() => {
    const flow = flowRef.current;
    if (!flow) return;

    flow.scrollTop = flow.scrollHeight;
  }, [history, mainQuestion, phase]);

  return (
    <section className="aur-conversation">
      <div ref={flowRef} aria-live="polite" className="aur-transcript">
        {isEmpty && (
          <p className="aur-transcript-empty">
            지금 마음에 떠오르는 것을 적어보세요.
          </p>
        )}

        {history.map((exchange, index) => (
          <div key={`${exchange.userText}-${index}`} className="aur-exchange">
            <div className="aur-turn">
              <div className="aur-turn-label">나</div>
              <div className="aur-turn-text">{exchange.userText}</div>
            </div>

            {exchange.hriResponse && (
              <div className="aur-turn">
                <div className="aur-turn-label aur-turn-label--host">AURINA</div>
                <div className="aur-turn-text aur-turn-text--host">{exchange.hriResponse}</div>
              </div>
            )}
          </div>
        ))}

        {mainQuestion && phase !== "done" && (
          <div className="aur-question">
            <div className="aur-turn-label aur-turn-label--host">AURINA</div>
            <div className="aur-question-text">{mainQuestion}</div>
          </div>
        )}

        {phase === "thinking" && (
          <div className="aur-thinking">AURINA가 흐름을 살펴보고 있습니다…</div>
        )}
      </div>

      <div className="aur-compose">
        <HriInput
          value={inputValue}
          onChange={onInputChange}
          onSubmit={onSubmit}
          placeholder="지금 떠오르는 것을 적어보세요."
          disabled={phase === "thinking" || phase === "done"}
          autoFocus
        />
      </div>
    </section>
  );
}
