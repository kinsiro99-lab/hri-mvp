import { useState, useEffect, useRef } from "react";
import HriInput from "../HriInput";
import type { VoiceInputState } from "./useVoiceInput";
import { AURINA_ASSETS } from "./assets";
import type { Notice } from "@/lib/notice/types";
import { resolveNoticeContent } from "@/lib/notice/types";
import type { UiLocale } from "@/lib/hri/locale";
import { UI_LOCALES } from "@/lib/hri/locale";
import { CONTENT } from "@/lib/i18n/content";
import { getAd, getActiveAdsByType } from "@/lib/ads/data";
import { resolveAdContent, type AdContent } from "@/lib/ads/types";
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
  locale: UiLocale;
  /** Multilingual Gate — undefined when a session already exists
   *  (locale is session-locked, Beta Handoff §2): the switcher renders
   *  only when this is provided, i.e. only pre-session (hasHistory
   *  false). See HriSession.tsx's handleLocaleChange for the guard. */
  onLocaleChange?: (locale: UiLocale) => void;
  /** Voice Session Stabilization — a single useVoiceInput instance
   *  created once by AurinaSpace (which outlives this component across
   *  the Arrival -> Conversation transition) and passed down here, so
   *  activating voice on Arrival's very first message persists into
   *  Conversation instead of resetting the moment Arrival unmounts. */
  voice: VoiceInputState;
  /** Android Voice Notice — one short line shown under the voice chip,
   *  supplied (or null) by AurinaSpace, which decides when. Display only. */
  voiceNotice?: string | null;
};

const NOTICE_PREVIEW_LIMIT = 60;
const NOTICE_CARD_TITLE_LIMIT = 24;

function noticePreview(body: string): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length > NOTICE_PREVIEW_LIMIT ? `${oneLine.slice(0, NOTICE_PREVIEW_LIMIT)}…` : oneLine;
}

function noticeCardTitle(title: string): string {
  const oneLine = title.replace(/\s+/g, " ").trim();
  return oneLine.length > NOTICE_CARD_TITLE_LIMIT ? `${oneLine.slice(0, NOTICE_CARD_TITLE_LIMIT)}…` : oneLine;
}

function renderLines(text: string) {
  return text.split("\n").map((line, i, arr) => (
    <span key={i}>
      {line}
      {i < arr.length - 1 && <br />}
    </span>
  ));
}

// RC Promo Gate — RC Production URL is not yet finalized (2+1 Layout
// Investigation §7/§8): copy only, no href/onClick anywhere on this
// card. Not localized on purpose — placeholder marketing copy pending
// a real URL and translated copy from RC, not Arrival's per-locale
// service content (see CONTENT in content.ts).
// Ad Structure V1 Gate — the RC_AD constant that used to live here was
// moved verbatim into src/lib/ads/data.ts (id "rc-reality-check") so
// Card/Banner/Full-page ads can share one data shape; this component
// now just looks it up (see RC_AD_ID below) instead of owning the copy.
const RC_AD_ID = "rc-reality-check";

// Visible Advertising Spaces Gate — a plain, universal "AD" badge,
// deliberately not routed through per-locale CONTENT (unlike
// RcAdCard's label/disclaimer props, which carry real provenance/
// disclaimer meaning) since "AD" needs no translation and is already
// recognized in every locale this app supports.
const AD_BADGE_LABEL = "AD";

// RC Ad Size Gate — the source image's own baked-in RC logo sits at
// y 246-382 and its baked-in (untranslatable) teal caption at y
// 436-464 out of 675 total (measured by pixel scan, not guessed). Only
// ~54px of clear space separates them — not enough room to fit a
// legible 2-line caption in between by cropping alone, so the new
// caption instead sits in a bottom scrim dark enough to fully cover
// the old caption's position (never cropped, image shown in full,
// so aspect ratio is untouched). The ~20% smaller footprint ask is
// handled separately, by .arrival-ad-card itself (see aurina.css).

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

// STEP V1 audit found no dedicated i18n key for this — reusing the
// existing KO-only-hardcoded-copy precedent already in this file
// (ARRIVAL_V1_CONNECTOR etc.) rather than adding a new content.ts key
// across all 7 locales for one small fallback notice.
const VOICE_UNSUPPORTED_NOTICE_KO = "이 브라우저에서는 음성 입력을 지원하지 않습니다. 직접 입력해 주세요.";
const VOICE_UNSUPPORTED_NOTICE_EN = "Voice input isn't supported in this browser — please type instead.";

// HOME V1 Service Scene Gate — approved, fixed copy for the upcoming
// V1 stage (record / store / replay / deliver a person's own words).
// Korean-only, deliberately kept outside per-locale CONTENT (no ja/en/
// fr/zh-* translation has been approved for this copy yet) — rendered
// only when locale === "ko", the same "don't invent a translation"
// contract RcAdCard's own placeholder copy already follows above (see
// its Gate comment). Announcement copy only: no upload/storage/
// scheduling/permission behavior is implemented anywhere in this
// codebase, this Scene only describes what is coming.
const ARRIVAL_V1_CONNECTOR = "곧, 마음의 거울은 V1으로 이어집니다.";
// V1 Title Line Break Gate — split into two explicit lines (desktop
// only, see .arrival-v1-title-break in aurina.css) so the title never
// auto-wraps mid-word ("마 / 음재생") at 1440px. Not a font-size/color
// change, and the underlying words are identical to the approved
// title, just broken at this exact point instead of with " · ".
const ARRIVAL_V1_TITLE_LINE1 = "HRI V1 — 마음기록 · 마음보관";
const ARRIVAL_V1_TITLE_LINE2 = "마음재생 · 마음전달";
const ARRIVAL_V1_BODY =
  "오늘 마음의 거울에 남긴 이야기는 기록되고 쌓입니다.\n다시 만나고 싶은 날 꺼내볼 수 있고, 먼 훗날 소중한 분에게 전할 수도 있습니다.";
const ARRIVAL_V1_SERVICE_ITEMS = [
  "사진·음성·영상 파일의 업로드 및 보관",
  "유고 시 전언의 지정일·지정 수신처 자동 송신",
  "개인 기록·파일·전언·지시사항의 수정 및 삭제 권한 보장",
  "보관기간 사용자 지정, 최장 10년",
];

// Same Gate as above — a large, independent full-width Scene (not a
// small card, not appended text inside the hero). Sits right after the
// hero (input + trust/privacy) and before the RC Ad/Notice card row —
// Beta Up Final Cleanup Gate: mirror experience -> V1 future ->
// notices/ads — never inside the hero, never disturbing the
// KEEP-protected cards/ad/utility-row order that follows it.
function ArrivalV1Scene() {
  return (
    <section className="arrival-v1-scene">
      <p className="arrival-v1-connector">{ARRIVAL_V1_CONNECTOR}</p>
      <h2 className="arrival-v1-title">
        {ARRIVAL_V1_TITLE_LINE1}<br className="arrival-v1-title-break" /> {ARRIVAL_V1_TITLE_LINE2}
      </h2>
      <p className="arrival-v1-body">{renderLines(ARRIVAL_V1_BODY)}</p>
      <div className="arrival-v1-service">
        <p className="arrival-v1-service-label">V1 SERVICE</p>
        <ul className="arrival-v1-service-list">
          {ARRIVAL_V1_SERVICE_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
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
  voice,
  voiceNotice,
}: Props) {
  const t = CONTENT[locale];
  // While an interim transcript is showing, the textarea's displayed
  // value is `inputValue` + the interim overlay (never persisted/
  // drafted — see STEP V4 §2); once resolved (isFinal or onend) the
  // overlay clears and displayValue collapses back to inputValue alone.
  const displayValue = voice.interimText
    ? `${inputValue}${inputValue.length > 0 && !/\s$/.test(inputValue) ? " " : ""}${voice.interimText}`
    : inputValue;
  // If the user types manually while an interim overlay is showing,
  // trust whatever is now on screen as the real value and drop the
  // overlay bookkeeping — never double-apply the dropped interim text
  // later via onend's own merge-in.
  const handleFieldChange = (value: string) => {
    if (voice.interimText) voice.clearInterim();
    onInputChange(value);
  };
  // Ad Structure V1 Gate — looked up by id rather than imported as a
  // constant so the card can go away cleanly (ad.active === false)
  // without an Arrival.tsx code change. No ad, or inactive, or no
  // resolvable content (ko fallback should always cover this while
  // the entry above has ko copy) -> the card simply doesn't render.
  const rcAd = getAd(RC_AD_ID);
  const rcAdContent = rcAd?.active ? resolveAdContent(rcAd, locale) : undefined;
  // Visible Advertising Spaces Gate — both driven entirely by the ads
  // registry (getActiveAdsByType), same "no ad -> renders nothing"
  // contract as rcAdContent above. active banner/full-page count is 0
  // today, so both are undefined and .arrival-ad-spaces doesn't mount
  // at all — the moment a real one is registered active in
  // src/lib/ads/data.ts, these appear with zero further code change.
  const bannerAd = getActiveAdsByType("banner")[0];
  const bannerAdContent = bannerAd ? resolveAdContent(bannerAd, locale) : undefined;
  const fullPageAd = getActiveAdsByType("full-page")[0];
  const fullPageAdContent = fullPageAd ? resolveAdContent(fullPageAd, locale) : undefined;
  // Notice Card Gate — first bottom card shows the latest published
  // Notice in place of the static Mirror card. notices is already
  // sorted published_at/created_at DESC server-side (listPublishedNotices),
  // so [0] is the latest. No notice -> falls back to the original card.
  const latestNotice = notices[0] ?? null;
  // Multilingual Notice Gate — resolved once, shared by both the card
  // preview and the full modal below, so they can never show two
  // different locales' content for the same notice.
  const localizedNotice = latestNotice ? resolveNoticeContent(latestNotice, locale) : null;
  const [noticeDetailOpen, setNoticeDetailOpen] = useState(false);
  // Mobile Language Icon Gate — the desktop horizontal switcher
  // (.arrival-locale-switcher) is hidden below 561px (aurina.css): a
  // 7-item row has no room left on a 360-390px header. Mobile reaches
  // the same locales through this dedicated globe/language icon
  // instead — a separate control from the hamburger (.arrival-menu),
  // which stays exactly as it was (decorative, no handler, unrelated
  // state). localeIconWrapRef backs the outside-click-to-close below.
  const [mobileLocaleOpen, setMobileLocaleOpen] = useState(false);
  const localeIconWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobileLocaleOpen) return;
    function handleOutside(e: MouseEvent) {
      if (localeIconWrapRef.current && !localeIconWrapRef.current.contains(e.target as Node)) {
        setMobileLocaleOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [mobileLocaleOpen]);
  const handleMirrorCard = () => {
    if (hasHistory) onViewHistory();
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
              minimal toggle, secondary to the main experience.
              Multilingual Localization Gate — extended from three
              options to six (+ zh-CN/zh-HK/zh-TW) without redesigning
              the switcher itself; .arrival-locale-switcher gained
              flex-wrap (aurina.css) so six items never overflow the
              header row on narrow screens.
              Mobile Language Icon Gate — this row is desktop-only now
              (hidden below 561px in aurina.css); mobile reaches the
              same 7 locales via the dedicated globe icon below instead. */}
          {onLocaleChange && (
            <div className="arrival-locale-switcher" role="group" aria-label="Language">
              {UI_LOCALES.map((loc, i) => (
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
          {/* Mobile Language Icon Gate — a dedicated globe/language
              control, independent of the hamburger below (separate
              element, separate state, no shared handler): mobile-only
              (hidden at >560px in aurina.css, same breakpoint as the
              switcher it replaces there), opens a compact vertical
              locale list. Only rendered pre-session, same guard as the
              desktop switcher (locale is session-locked once a
              conversation exists — Beta Handoff §2). */}
          {onLocaleChange && (
            <div className="arrival-locale-icon-wrap" ref={localeIconWrapRef}>
              <button
                type="button"
                className="arrival-locale-icon"
                aria-label={t.arrival.languageIconAria}
                aria-haspopup="menu"
                aria-expanded={mobileLocaleOpen}
                onClick={() => setMobileLocaleOpen((open) => !open)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </button>
              {mobileLocaleOpen && (
                <div className="arrival-locale-menu" role="group" aria-label="Language">
                  {UI_LOCALES.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      className={`arrival-locale-menu-item${locale === loc ? " arrival-locale-menu-item--active" : ""}`}
                      onClick={() => {
                        onLocaleChange(loc);
                        setMobileLocaleOpen(false);
                      }}
                    >
                      <span>{t.localeSwitcher[loc]}</span>
                      {locale === loc && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
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

          <p className="arrival-core-question">
            {t.arrival.coreQuestion}
          </p>

          {/* First Entry Gate — Permission/Example sit between the core
              question and the input, so the "what am I allowed to say"
              barrier is resolved before the user reaches the textarea,
              not after (Arrival.tsx's chips/trustText, further below,
              are too late in the visual flow to serve this purpose).
              Example is plain text, not clickable — it shows the
              allowed range, not a survey/suggestion to pick from. */}
          <p className="arrival-permission">{t.arrival.permissionText}</p>
          {/* Readability Gate — ko-only: matches permissionText's font-
              size/color instead of the smaller/grayer fine-print look
              ja/en's own example line (still arrival-example) keeps. */}
          <p className={locale === "ko" ? "arrival-example-readable" : "arrival-example"}>
            {t.arrival.exampleText}
          </p>

          <div className="arrival-pill-zone">
            <HriInput
              value={displayValue}
              onChange={handleFieldChange}
              onSubmit={onSubmit}
              placeholder={t.arrival.inputPlaceholder}
              autoFocus
              locale={locale}
            />
          </div>

          {/* First View Benefit Position Correction — this row used to
              carry a two-column layout with a Benefit Message column on
              the right (see the HOME V1 Service Scene Gate above,
              ArrivalV1Scene); that explanatory column and all of its
              dedicated CSS were removed, so only the chips+trust
              primary column remains here. */}
          <div className="arrival-below-input">
            <div className="arrival-below-input-primary">
              <div className="arrival-chips">
                <span className="arrival-chip">{t.arrival.enterHint}</span>
                {/* Voice Input Gate (STEP V4/V8/V11) — same chip, no
                    redesign: the label itself is now the whole
                    idle/listening/produced state indicator (see
                    useVoiceInput.ts's own `label`), and clicking while
                    unsupported reveals one small notice line below
                    instead of doing nothing. */}
                <button
                  type="button"
                  className="arrival-chip arrival-chip--action"
                  aria-pressed={voice.status === "listening"}
                  onClick={() => {
                    if (voice.status === "unsupported") return;
                    voice.toggle();
                  }}
                >
                  {voice.label}
                </button>
                <button type="button" className="arrival-chip arrival-chip--action">
                  {t.arrival.anonymousChip}
                </button>
              </div>
              {voice.status === "unsupported" && (
                <p className="arrival-example">
                  {locale === "ko" ? VOICE_UNSUPPORTED_NOTICE_KO : VOICE_UNSUPPORTED_NOTICE_EN}
                </p>
              )}
              {voiceNotice && <p className="voice-android-notice" role="note">{voiceNotice}</p>}

              <div className="arrival-notice">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
                </svg>
                <div>
                  {/* Trust Layout Gate — a plain factual data-handling line,
                      kept visually distinct (bolder/higher-contrast) from
                      the trustText above it since it states something
                      concrete about how conversations are actually handled
                      rather than describing the feeling of the space. Wording
                      is deliberately narrower than "never stored"/"no one
                      can see it"/"fully anonymous" — those aren't backed by
                      the current implementation (see observation_events +
                      the admin observation viewer); "not made public" is.
                      Left Info Order Final — ko-only: the user's confirmed
                      reading order puts this privacy line last, after
                      noticeText, not 2nd. Every other locale keeps its
                      original order (privacy before notice) untouched,
                      since only ko's copy has been finalized so far. */}
                  {locale === "ko" ? (
                    <>
                      <p className="arrival-notice-readable">{renderLines(t.arrival.noticeText)}</p>
                      <p className="arrival-notice-privacy">{t.arrival.privacyText}</p>
                    </>
                  ) : (
                    <>
                      <p className="arrival-notice-privacy">{t.arrival.privacyText}</p>
                      {/* Readability Gate — ko-only note applies to the ko
                          branch above; this branch (ja/en/fr/zh-*) keeps
                          the original unclassed treatment untouched. */}
                      <p>{renderLines(t.arrival.noticeText)}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Notice Card Gate — the separate Notice banner that used to
              render here was removed: the latest Notice now shows in
              the first bottom card instead (see latestNotice above),
              so the same Notice is never shown twice on Arrival. */}
        </div>

        <div className="arrival-portrait">
          <img src={AURINA_ASSETS.arrivalHeroImage} alt="AURINA" />
        </div>
      </div>

      {locale === "ko" && <ArrivalV1Scene />}

      <div className="arrival-cards">
        {rcAdContent && (
          <RcAdCard
            content={rcAdContent}
            image={rcAd!.image}
            label={t.arrival.adLabel}
            disclaimer={t.arrival.adDisclaimer}
            imageLine1={t.arrival.adImageLine1}
            openingBadge={t.arrival.adOpeningBadge}
          />
        )}
        <ServiceCard
          icon={<OrbIcon />}
          title={localizedNotice ? noticeCardTitle(localizedNotice.title) : t.arrival.cards.mirrorTitle}
          line={
            localizedNotice
              ? noticePreview(localizedNotice.body)
              : hasHistory
                ? t.arrival.cards.mirrorLineHistory
                : t.arrival.cards.mirrorLineDefault
          }
          onClick={latestNotice ? () => setNoticeDetailOpen(true) : handleMirrorCard}
        />
      </div>

      {/* Visible Advertising Spaces Gate — a separate, independent ad
          information area below the HRI card row (HRI Experience ->
          HRI Information -> Advertising). Never rendered when both are
          absent, so no empty box ever shows. */}
      {(bannerAdContent || fullPageAdContent) && (
        <div className="arrival-ad-spaces">
          {bannerAd && bannerAdContent && (
            <BannerAdSlot content={bannerAdContent} destination={bannerAd.destination} />
          )}
          {fullPageAd && fullPageAdContent && (
            <FullPageAdEntry id={fullPageAd.id} title={fullPageAdContent.title} locale={locale} />
          )}
        </div>
      )}

      {/* 2+1 Layout Gate — the 3 static cards this replaced (Mirror /
          Rhythm / Next) each branched on hasHistory/hasFinal to reach
          onViewHistory/onViewFinal/onRestart; that reach-back is kept
          here, unchanged, as a small utility row instead of a card.
          Same conditions as before, same handlers, nothing new. */}
      {(hasHistory || hasFinal) && (
        <div className="aurina-utility-row arrival-utility-row">
          {hasHistory && (
            <button type="button" className="aurina-utility-link" onClick={onViewHistory}>
              {t.arrival.historyLink}
            </button>
          )}
          {hasFinal && (
            <button type="button" className="aurina-utility-link" onClick={onViewFinal}>
              {t.arrival.finalLink}
            </button>
          )}
          <button type="button" className="aurina-utility-link aurina-utility-link--muted" onClick={onRestart}>
            {t.arrival.restartLink}
          </button>
        </div>
      )}

      {localizedNotice && noticeDetailOpen && (
        <NoticeDetailModal title={localizedNotice.title} body={localizedNotice.body} onClose={() => setNoticeDetailOpen(false)} closeLabel={t.common.close} />
      )}
    </section>
  );
}

// Notice Detail Gate — inline styles only (no aurina.css changes), so
// this stays a single-file, additive change. title/body are rendered
// verbatim from whatever the caller resolved, never hardcoded.
// Multilingual Localization Gate — closeLabel replaces the two spots
// that used to hardcode Korean "닫기" regardless of locale.
// Multilingual Notice Gate — takes the already-resolved title/body
// (not a raw Notice) so it can never pick a different locale than the
// card that opened it — see localizedNotice above.
function NoticeDetailModal({ title, body, onClose, closeLabel }: { title: string; body: string; onClose: () => void; closeLabel: string }) {
  // Mobile Beta Notice Scroll Fix — this component is mounted fresh
  // every time it opens ({latestNotice && noticeDetailOpen && <.../>}
  // above), but on mobile the freshly-mounted scrollable content div
  // can still render already mid-scroll (carried over from this same
  // div's previous open, or from surrounding layout/focus timing).
  // Force just this element's own scrollTop to 0 on every mount — the
  // page/body scroll position is never touched, and closing still
  // leaves the underlying HOME scroll exactly where it was.
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, []);

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20, 16, 10, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "24px",
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "28px 26px",
          maxWidth: "480px",
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 20px 48px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#1a1a1a" }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            style={{
              flex: "none",
              border: "none",
              background: "none",
              fontSize: "20px",
              lineHeight: 1,
              cursor: "pointer",
              color: "#666",
              padding: "2px 4px",
            }}
          >
            ×
          </button>
        </div>
        <p style={{ marginTop: "16px", marginBottom: "20px", fontSize: "14px", lineHeight: 1.6, color: "#333", whiteSpace: "pre-wrap" }}>
          {body}
        </p>
        <button
          type="button"
          onClick={onClose}
          style={{
            display: "block",
            marginLeft: "auto",
            padding: "8px 20px",
            fontSize: "13px",
            border: "1px solid #333",
            borderRadius: "8px",
            background: "#333",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
}

// RC Promo Gate — plain markup, no <button>: this card has no click
// target of its own while the URL is unset (§7/§8). Image is exposed
// directly (no click needed to see it), matching the requirement that
// the ad be visible without interaction.
// RC Provenance Gate — label + disclaimer make clear RC is a separate
// service from HRI, not shared data/identity; both localized (unlike
// the ad's own content, which is placeholder pending real URL/
// translation) since the label/disclaimer wording was given in all 3
// languages.
// Ad Structure V1 Gate — `content` is the resolved (locale, with ko
// fallback) AdContent for this ad; label/disclaimer/imageLine1/
// openingBadge stay as separate props, sourced from CONTENT same as
// before, since those are already fully translated per-locale and
// this migration only moved the ad's own (ko-only) copy.
function RcAdCard({
  content,
  image,
  label,
  disclaimer,
  imageLine1,
  openingBadge,
}: {
  content: AdContent;
  image?: string;
  label: string;
  disclaimer: string;
  imageLine1: string;
  openingBadge: string;
}) {
  return (
    <div className="arrival-ad-card">
      <div className="arrival-ad-label">{label}</div>
      {/* RC Card Internal Layout Gate — image left (~43%) / copy right
          (~57%), not the old full-width-image-then-copy-below stack.
          Only .arrival-ad-row's own flex-direction flips (row -> column)
          at the existing <=860px breakpoint; grid 2:1 / HOME width are
          untouched. */}
      <div className="arrival-ad-row">
        <div className="arrival-ad-media">
          {/* Image shown in full, uncropped, native 1200:675 ratio —
              aspect-ratio + object-fit:cover here only guards against
              any container rounding, they don't crop anything away. */}
          <img src={image ?? AURINA_ASSETS.rcAdImage} alt="" className="arrival-ad-image" />
          {/* Approved image-caption standard §3/§6 — the localized
              replacement caption. The scrim beneath it is opaque enough
              by the time it reaches the source PNG's own baked-in
              teal caption (y 436-464/675) to cover it, so the two
              never visibly double up. Switches with `locale` via
              existing CONTENT, never all 3 languages at once. */}
          <div className="arrival-ad-image-caption">
            <span className="arrival-ad-caption-line1">{imageLine1}</span>
            <span className="arrival-ad-caption-line2">{content.imageLine2}</span>
          </div>
        </div>
        <div className="arrival-ad-body">
          <h3 className="arrival-ad-title">{renderLines(content.title)}</h3>
          <p className="arrival-ad-description">{renderLines(content.description ?? "")}</p>
          <span className="arrival-ad-cta" aria-disabled="true">
            {content.ctaLabel}
            <span className="arrival-ad-cta-badge">{openingBadge}</span>
          </span>
        </div>
      </div>
      <p className="arrival-ad-disclaimer">{disclaimer}</p>
    </div>
  );
}

// Visible Advertising Spaces Gate §3 — a Banner is deliberately the
// smallest, least prominent ad shape: a single-line strip, never a
// large box. Arrival only mounts this when bannerAdContent is truthy
// (see above), so an inactive/absent banner never shows as an empty
// placeholder. destination is optional, same "keep CTA inert, never
// invent a URL" contract as RcAdCard.
function BannerAdSlot({ content, destination }: { content: AdContent; destination?: string }) {
  const body = (
    <>
      <span className="arrival-banner-ad-label">{AD_BADGE_LABEL}</span>
      <span className="arrival-banner-ad-title">{content.title}</span>
      {content.ctaLabel && <span className="arrival-banner-ad-cta">{content.ctaLabel}</span>}
    </>
  );
  return destination ? (
    <a className="arrival-banner-ad" href={destination}>
      {body}
    </a>
  ) : (
    <div className="arrival-banner-ad" aria-disabled="true">
      {body}
    </div>
  );
}

// Visible Advertising Spaces Gate §6 — the only way into /ad/[id] from
// the live HRI screen. Wired to the ads registry, not hardcoded: it
// simply isn't rendered when getActiveAdsByType("full-page") is empty
// (see fullPageAd above) — the moment a real full-page ad is
// registered active, this entry appears automatically.
// Multilingual Localization Gate — carries the current UI locale as a
// query param so /ad/[id] (which resolves its own locale independently
// from ?locale=, see app/ad/[id]/page.tsx) shows matching-language ad
// copy instead of always defaulting to ko.
function FullPageAdEntry({ id, title, locale }: { id: string; title: string; locale: UiLocale }) {
  return (
    <a className="arrival-fullpage-entry" href={`/ad/${id}?locale=${encodeURIComponent(locale)}`}>
      <span className="arrival-fullpage-entry-label">{AD_BADGE_LABEL}</span>
      <span className="arrival-fullpage-entry-title">{title}</span>
      <span aria-hidden="true">→</span>
    </a>
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
  onClick?: () => void;
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

