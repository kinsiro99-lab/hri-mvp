import { AURINA_ASSETS } from "./assets";
import "./aurina.css";

type Props = {
  reflection: string | null;
  onRestart: () => void;
};

/**
 * Reflection — Page 2. One continuous experience across three layers:
 * 마음의 거울 (observation) → 리듬의 이해 (awareness) → 다음 리듬
 * (acceptance / forward direction). Fades in as a staged sequence
 * (header → mirror → rhythm → guide), respecting prefers-reduced-motion.
 *
 * Layer 1 renders the engine's real reflection text (only reshaped
 * typographically — split into its natural paragraphs), unmodified.
 * Layer 2 reuses the exact same real paragraphs — no new data — as
 * short excerpts organized under Pattern/Relationship/Meaning, so it
 * reads as a second lens on the same real content, not a duplicate of
 * Layer 1's full text and not fabricated per-session interpretation.
 * Layer 3 is static, approved copy.
 */
export default function Reflection({ reflection, onRestart }: Props) {
  const paragraphs = splitReflection(reflection);

  return (
    <section className="reflection">
      <header className="reflection-header reflection-fade" style={{ animationDelay: "0ms" }}>
        <div className="reflection-portrait">
          <img src={AURINA_ASSETS.identityImage} alt="" aria-hidden="true" />
        </div>
        <div className="reflection-wordmark">AURINA</div>
        <h1 className="reflection-title">당신의 마음에 나타난 흐름</h1>
        <p className="reflection-subtitle">
          지금까지의 이야기를 바탕으로
          <br />
          당신의 마음에 나타난 흐름을
          <br />
          살펴보겠습니다.
        </p>
      </header>

      <section
        className="reflection-layer reflection-fade"
        style={{ animationDelay: "150ms" }}
        aria-labelledby="reflection-layer-1"
      >
        <h2 id="reflection-layer-1" className="reflection-layer-title">
          마음의 거울
        </h2>
        <div className="reflection-mirror">
          {paragraphs.length > 0 ? (
            paragraphs.map((p, i) => <p key={i}>{p}</p>)
          ) : (
            <p>아직 드러나지 않았습니다.</p>
          )}
        </div>
      </section>

      <section
        className="reflection-layer reflection-fade"
        style={{ animationDelay: "300ms" }}
        aria-labelledby="reflection-layer-2"
      >
        <h2 id="reflection-layer-2" className="reflection-layer-title">
          리듬의 이해
        </h2>
        <RhythmPath paragraphs={paragraphs} />
      </section>

      <section
        className="reflection-layer reflection-layer--closing reflection-fade"
        style={{ animationDelay: "450ms" }}
        aria-labelledby="reflection-layer-3"
      >
        <h2 id="reflection-layer-3" className="reflection-layer-title">
          다음 리듬
        </h2>
        <p className="reflection-closing">
          오늘 당신은 자신의 마음을 하나의 흐름으로 바라보기 시작했습니다.
          <br />
          <br />
          흐름을 이해하는 것은 끝이 아니라 시작입니다.
          <br />
          <br />
          AURINA는 당신이 자신의 리듬을 이해하고,
          <br />
          그 모습을 인정하며,
          <br />
          다시 걸어갈 수 있도록 함께합니다.
        </p>
        <button type="button" className="reflection-restart" onClick={onRestart}>
          다시 대화하기
        </button>
      </section>
    </section>
  );
}

function splitReflection(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

const EXCERPT_LIMIT = 36;

function excerpt(text: string): string {
  return text.length > EXCERPT_LIMIT ? `${text.slice(0, EXCERPT_LIMIT)}…` : text;
}

// Pattern / Relationship / Meaning — not new data. Each node is a short
// excerpt of the same real reflection paragraphs shown in full in
// Layer 1, reorganized under a different lens rather than repeated.
const RHYTHM_LABELS = ["패턴", "관계", "의미"];

function RhythmPath({ paragraphs }: { paragraphs: string[] }) {
  const nodes = paragraphs.slice(0, RHYTHM_LABELS.length);

  if (nodes.length === 0) {
    return (
      <div className="rhythm-path" aria-hidden="true">
        <div className="rhythm-node">
          <span className="rhythm-label">아직 드러나지 않았습니다</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rhythm-path" aria-hidden="true">
      {nodes.map((text, i) => (
        <div
          className="rhythm-node"
          key={RHYTHM_LABELS[i]}
          style={{ animationDelay: `${i * 0.35}s` }}
        >
          <span className="rhythm-tag">{RHYTHM_LABELS[i]}</span>
          <span className="rhythm-label">{excerpt(text)}</span>
        </div>
      ))}
    </div>
  );
}
