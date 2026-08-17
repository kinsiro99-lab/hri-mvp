import HriInput from "../HriInput";
import { AURINA_ASSETS } from "./assets";
import "./aurina.css";

type Props = {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: (rawText?: string) => void;
};

/**
 * Arrival — the landing experience, built to the approved AURINA target
 * image. Static brand copy only; no engine data is read here. The
 * pill input is the same HriInput used in Conversation, so the input
 * experience is consistent from the very first moment.
 *
 * Voice, Menu, and Anonymous affordances are visual only — no handler,
 * no state. AurinaVoice is intentionally not used here; it begins once
 * Conversation starts.
 */
// Cards are navigation objects into the journey, not explanations — a
// click brings the user straight to the input, the only real "next step"
// this beta has. No fabricated per-card destinations.
function focusArrivalInput() {
  const zone = document.querySelector(".arrival-pill-zone");
  zone?.scrollIntoView({ behavior: "smooth", block: "center" });
  const field = zone?.querySelector<HTMLTextAreaElement>(".hri-pill-input");
  field?.focus();
}

export default function Arrival({ inputValue, onInputChange, onSubmit }: Props) {
  return (
    <section className="arrival">
      <header className="arrival-header">
        <div className="arrival-brand">
          <img src={AURINA_ASSETS.arrivalLogoLight} alt="" className="arrival-brand-avatar" />
          <div>
            <div className="arrival-brand-name">AURINA</div>
            <div className="arrival-brand-eyebrow">HUMAN RHYTHM INTELLIGENCE</div>
          </div>
        </div>

        {/* Visual only — no implementation this phase */}
        <button type="button" className="arrival-menu" aria-label="메뉴">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      <div className="arrival-hero">
        <div className="arrival-hero-content">
          <h1 className="arrival-headline">
            당신의 마음을 비추는 거울.
          </h1>

          <p className="arrival-description">
            당신의 지금을 함께 바라봅니다.
          </p>

          <p className="arrival-core-question">
            지금 마음에 가장 먼저 떠오르는 것은 무엇인가요?
          </p>

          <div className="arrival-pill-zone">
            <HriInput
              value={inputValue}
              onChange={onInputChange}
              onSubmit={onSubmit}
              placeholder="지금 떠오르는 것을 적어보세요"
              autoFocus
            />
          </div>

          <div className="arrival-chips">
            <span className="arrival-chip">Enter로 계속하기</span>
            {/* Visual only — no implementation this phase */}
            <button type="button" className="arrival-chip arrival-chip--action">
              음성으로 이야기하기
            </button>
            <button type="button" className="arrival-chip arrival-chip--action">
              익명으로 시작하기
            </button>
          </div>

          <div className="arrival-notice">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
            </svg>
            <p>
              HRI는 평가나 진단을 위한 도구가 아닙니다.
              <br />
              현재 삶에 나타나는 생각과 흐름을 통해 당신의 리듬을 관찰할 수 있도록 돕습니다.
            </p>
          </div>

          <div className="arrival-declaration">
            <p className="arrival-declaration-text">
              당신의 대화는 더 나은 질문으로 이어집니다.
            </p>
            <p className="arrival-declaration-tag">HRI Evolution Beta</p>
          </div>
        </div>

        <div className="arrival-portrait">
          <img src={AURINA_ASSETS.arrivalHeroImage} alt="AURINA" />
        </div>
      </div>

      <div className="arrival-cards">
        <ServiceCard icon={<OrbIcon />} title="마음의 거울" line="지금의 나를 비추어 봅니다." />
        <ServiceCard icon={<WaveIcon />} title="리듬의 이해" line="마음의 흐름을 발견합니다." />
        <ServiceCard icon={<SproutIcon />} title="다음 리듬" line="새로운 방향을 함께 찾습니다." />
      </div>
    </section>
  );
}

function ServiceCard({
  icon,
  title,
  line,
}: {
  icon: React.ReactNode;
  title: string;
  line: string;
}) {
  return (
    <button type="button" className="arrival-card" onClick={focusArrivalInput}>
      <div className="arrival-card-icon">{icon}</div>
      <h3 className="arrival-card-title">{title}</h3>
      <p className="arrival-card-line">{line}</p>
      <span className="arrival-card-arrow" aria-hidden="true">→</span>
    </button>
  );
}

function OrbIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <radialGradient id="arrivalOrb" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#f6e9d0" />
          <stop offset="100%" stopColor="#c9a877" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="16" fill="url(#arrivalOrb)" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M4 24 Q10 14 16 24 T28 24 T40 24" stroke="#8fa8c9" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M4 19 Q10 9 16 19 T28 19 T40 19" stroke="#c9a877" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function SproutIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 34 V18" stroke="#8a9a6b" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M20 20 C20 12 12 10 10 10 C10 18 16 20 20 20 Z" fill="#a8bb85" />
      <path d="M20 24 C20 17 27 15 29 15 C29 22 24 24 20 24 Z" fill="#c9a877" />
    </svg>
  );
}
