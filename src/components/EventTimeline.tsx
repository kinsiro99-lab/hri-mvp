import type { HriEvent } from "@/lib/hri/types";

type EventTimelineProps = {
  events: HriEvent[];
};

export default function EventTimeline({ events }: EventTimelineProps) {
  if (events.length === 0) return null;

  return (
    <div className="history-area" aria-label="이전 흐름">
      {events.map((event, index) => {
        const isLatest = index === events.length - 1;

        if (event.type === "user_input") {
          return (
            <div className="exchange" key={event.id}>
              <p className="user-entry">{event.text}</p>
            </div>
          );
        }

        if (event.type === "question") {
          return (
            <p
              className={isLatest ? "active-question fade-in" : "hri-response"}
              key={event.id}
              aria-live={isLatest ? "polite" : undefined}
            >
              {event.text}
            </p>
          );
        }

        if (event.type === "reflection") {
          return (
            <div
              className="reflection-block fade-in"
              key={event.id}
              aria-live="polite"
              role="region"
              aria-label="흐름 요약"
            >
              <span className="reflection-label">흐름 요약</span>
              <p className="reflection-text">{event.text}</p>
            </div>
          );
        }

        if (event.type === "whisper") {
          return (
            <p className="hri-response whisper-line fade-in" key={event.id}>
              {event.text}
            </p>
          );
        }

        if (event.type === "safety") {
          return (
            <p className="error-msg fade-in" key={event.id} role="alert">
              {event.text}
            </p>
          );
        }

        return null;
      })}
    </div>
  );
}
