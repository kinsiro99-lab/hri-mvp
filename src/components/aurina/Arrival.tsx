import HriInput from "../HriInput";
import { AURINA_ASSETS } from "./assets";
import type { Notice } from "@/lib/notice/types";
import type { Locale } from "@/lib/hri/locale";
import { CONTENT, formatNoticeDate } from "@/lib/i18n/content";
import "./aurina.css";

type Props = {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: (rawText?: string) => void;
  notices: Notice[];
  hasHistory: boolean;
  hasFinal: boolean;
  onViewHistory: () => void;
  onViewFinal: () => void;
  onRestart: () => void;
  locale: Locale;
  /** Multilingual Gate — undefined when a session already exists
   *  (locale is session-locked, Beta Handoff §2): the switcher renders
   *  only when this is provided, i.e. only pre-session (hasHistory
   *  false). See HriSession.tsx's handleLocaleChange for the guard. */
  onLocaleChange?: (locale: Locale) => void;
};

const NOTICE_PREVIEW_LIMIT = 60;

function noticePreview(body: string): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length > NOTICE_PREVIEW_LIMIT ? `${oneLine.slice(0, NOTICE_PREVIEW_LIMIT)}…` : oneLine;
}

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
// Cards are real navigation objects into HRI's actual 3-stage
// experience (Conversation -> Reflection -> new Conversation), not a
// single fabricated destination: each one branches on whether a
// session/Final already exists (hasHistory/hasFinal, both computed
// upstream in HriSession.tsx from the same allInputs/reflection state
// every other view already reads — no new state model invented here).
function focusArrivalInput() {
  const zone = document.querySelector(".arrival-pill-zone");
  zone?.scrollIntoView({ behavior: "smooth", block: "center" });
  const field = zone?.querySelector<HTMLTextAreaElement>(".hri-pill-input");
  field?.focus();
}

export default function Arrival({
  inputValue,
  onInputChange,
  onSubmit,
  notices,
  hasHistory,
  hasFinal,
  onViewHistory,
  onViewFinal,
  onRestart,
  locale,
  onLocaleChange,
}: Props) {
  const t = CONTENT[locale];
  const handleMirrorCard = () => {
    if (hasHistory) onViewHistory();
    else focusArrivalInput();
  };
  const handleRhythmCard = () => {
    if (hasFinal) onViewFinal();
    else focusArrivalInput();
  };
  const handleNextCard = () => {
    if (hasHistory || hasFinal) onRestart();
    else focusArrivalInput();
  };

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

        <div className="arrival-header-actions">
          {/* Multilingual Gate — Beta Handoff §2/§12 (Japanese), §4
              (English): only rendered pre-session (onLocaleChange is
              undefined once hasHistory is true, see HriSession.tsx),
              minimal toggle, secondary to the main experience. Extended
              from two options to three (ko/ja/en) without redesigning
              the switcher itself. */}
          {onLocaleChange && (
            <div className="arrival-locale-switcher" role="group" aria-label="Language">
              {(["ko", "ja", "en"] as const).map((loc, i) => (
                <span key={loc} className="arrival-locale-item">
                  {i > 0 && <span className="arrival-locale-sep">|</span>}
                  <button
                    type="button"
                    className={`arrival-locale-btn${locale === loc ? " arrival-locale-btn--active" : ""}`}
                    onClick={() => onLocaleChange(loc)}
                  >
                    {t.localeSwitcher[loc]}
                  </button>
                </span>
              ))}
            </div>
          )}
          {/* Visual only — no implementation this phase */}
          <button type="button" className="arrival-menu" aria-label={t.arrival.menuAria}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </header>

      <div className="arrival-hero">
        <div className="arrival-hero-content">
          <h1 className="arrival-headline">
            {t.arrival.headline}
          </h1>

          <p className="arrival-description">
            {t.arrival.description}
          </p>

          <p className="arrival-core-question">
            {t.arrival.coreQuestion}
          </p>

          <div className="arrival-pill-zone">
            <HriInput
              value={inputValue}
              onChange={onInputChange}
              onSubmit={onSubmit}
              placeholder={t.arrival.inputPlaceholder}
              autoFocus
              locale={locale}
            />
          </div>

          <div className="arrival-chips">
            <span className="arrival-chip">{t.arrival.enterHint}</span>
            {/* Visual only — no implementation this phase */}
            <button type="button" className="arrival-chip arrival-chip--action">
              {t.arrival.voiceChip}
            </button>
            <button type="button" className="arrival-chip arrival-chip--action">
              {t.arrival.anonymousChip}
            </button>
          </div>

          <div className="arrival-notice">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
            </svg>
            <p>
              {t.arrival.noticeText.split("\n").map((line, i, arr) => (
                <span key={i}>
                  {line}
                  {i < arr.length - 1 && <br />}
                </span>
              ))}
            </p>
          </div>

          {/* Notice System Gate §4 — sits right after the required
              legal notice, deliberately quieter than the question/
              input above it. No notices -> no DOM at all (no empty
              box). Capped to 3, most-recently-published first
              (already enforced server-side by listPublishedNotices).
              Multilingual Gate — the wrapper label is localized; the
              notice title/body themselves are admin-authored content
              (Notice architecture is explicitly untouched this Gate,
              Beta Handoff §9/§12) and are shown verbatim regardless of
              locale. */}
          {notices.length > 0 && (
            <div className="arrival-notices">
              {notices.map((n) => (
                <div key={n.id} className="arrival-notice-item">
                  <div className="arrival-notice-kicker">
                    {t.arrival.noticeKicker(formatNoticeDate(n.publishedAt ?? n.createdAt, locale))}
                  </div>
                  <div className="arrival-notice-title">{n.title}</div>
                  <p className="arrival-notice-preview">{noticePreview(n.body)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="arrival-portrait">
          <img src={AURINA_ASSETS.arrivalHeroImage} alt="AURINA" />
        </div>
      </div>

      <div className="arrival-cards">
        <ServiceCard
          icon={<OrbIcon />}
          title={t.arrival.cards.mirrorTitle}
          line={hasHistory ? t.arrival.cards.mirrorLineHistory : t.arrival.cards.mirrorLineDefault}
          onClick={handleMirrorCard}
        />
        <ServiceCard
          icon={<WaveIcon />}
          title={t.arrival.cards.rhythmTitle}
          line={hasFinal ? t.arrival.cards.rhythmLineFinal : t.arrival.cards.rhythmLineDefault}
          onClick={handleRhythmCard}
        />
        <ServiceCard
          icon={<SproutIcon />}
          title={t.arrival.cards.nextTitle}
          line={hasHistory || hasFinal ? t.arrival.cards.nextLineRestart : t.arrival.cards.nextLineDefault}
          onClick={handleNextCard}
        />
      </div>
    </section>
  );
}

function ServiceCard({
  icon,
  title,
  line,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  line: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="arrival-card" onClick={onClick}>
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
