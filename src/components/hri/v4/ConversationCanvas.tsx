import { useEffect, useRef } from "react";
import HriInput from "../../HriInput";

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

  useEffect(() => {
    const flow = flowRef.current;
    if (!flow) return;

    flow.scrollTop = flow.scrollHeight;
  }, [history, mainQuestion, phase]);

  return (
    <section
      style={{
        width: "100%",
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "0 40px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          height: "430px",
          display: "grid",
          gridTemplateRows: "1fr auto",
          overflow: "hidden",
          background: "#ffffff",
          border: "1px solid #d9e1ec",
          borderRadius: "24px",
          boxShadow: "0 12px 32px rgba(27, 55, 95, 0.08)",
        }}
      >
        <div
          ref={flowRef}
          aria-live="polite"
          style={{
            minHeight: 0,
            overflowY: "auto",
            padding: "28px 32px 16px",
          }}
        >
          {history.length === 0 && !mainQuestion && (
            <div
              style={{
                maxWidth: "760px",
                color: "#667085",
                fontSize: "18px",
                lineHeight: 1.7,
              }}
            >
              지금 마음에 떠오르는 것을 적어보세요.
            </div>
          )}

          {history.map((exchange, index) => (
            <div
              key={`${exchange.userText}-${index}`}
              style={{
                marginBottom: "26px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: "14px",
                }}
              >
                <div
                  style={{
                    maxWidth: "72%",
                    padding: "13px 17px",
                    borderRadius: "18px 18px 4px 18px",
                    background: "#edf3fb",
                    color: "#172b4d",
                    fontSize: "18px",
                    lineHeight: 1.65,
                  }}
                >
                  {exchange.userText}
                </div>
              </div>

              {exchange.hriResponse && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "76%",
                      padding: "4px 0 4px 16px",
                      borderLeft: "3px solid #8da9cc",
                      color: "#2e405c",
                      fontSize: "18px",
                      lineHeight: 1.7,
                    }}
                  >
                    {exchange.hriResponse}
                  </div>
                </div>
              )}
            </div>
          ))}

          {mainQuestion && phase !== "done" && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
                marginTop: "10px",
                paddingBottom: "12px",
              }}
            >
              <div
                style={{
                  maxWidth: "76%",
                  padding: "4px 0 4px 16px",
                  borderLeft: "3px solid #466f9f",
                }}
              >
                <div
                  style={{
                    marginBottom: "7px",
                    color: "#6b7f99",
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                  }}
                >
                  AURINA
                </div>

                <div
                  style={{
                    color: "#132b4f",
                    fontSize: "20px",
                    fontWeight: 600,
                    lineHeight: 1.65,
                  }}
                >
                  {mainQuestion}
                </div>
              </div>
            </div>
          )}

          {phase === "thinking" && (
            <div
              style={{
                color: "#7a8798",
                fontSize: "15px",
                padding: "8px 0",
              }}
            >
              AURINA가 흐름을 살펴보고 있습니다…
            </div>
          )}
        </div>

        <div
          style={{
            padding: "14px 18px 18px",
            borderTop: "1px solid #e6ebf2",
            background: "#fbfcfe",
          }}
        >
          <HriInput
            value={inputValue}
            onChange={onInputChange}
            onSubmit={onSubmit}
            placeholder="지금 떠오르는 것을 적어보세요."
            disabled={phase === "thinking" || phase === "done"}
            autoFocus
          />
        </div>
      </div>
    </section>
  );
}