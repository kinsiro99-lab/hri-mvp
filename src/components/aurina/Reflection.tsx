import { useEffect, useRef, useState } from "react";
import { AURINA_ASSETS } from "./assets";
import { SPEECH_LANG_BY_LOCALE } from "./useVoiceInput";
import { splitFinalExperience } from "../../lib/hri/intelligence/finalExperienceTypes";
import type { UiLocale } from "@/lib/hri/locale";
import { CONTENT } from "@/lib/i18n/content";
import "./aurina.css";

// Final Voice Reflection Gate (STEP V8) — minimal feature-detected
// speechSynthesis wiring, same "no new npm package, locally-scoped
// types only where the DOM lib doesn't already cover it" discipline as
// useVoiceInput.ts. Unlike SpeechRecognition, this project's DOM lib
// DOES already type window.speechSynthesis/SpeechSynthesisUtterance
// (they're standard, unprefixed since Chrome 33/Safari 7/Edge 14 —
// see STEP V7's own BCD lookup), so no local type declarations are
// needed here at all.
function isTtsSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance !== "undefined";
}

/** Best-effort only — never a hardcoded voice name (STEP V8 §6). Picks
 *  the first installed voice whose own `lang` shares the current UI
 *  locale's primary language subtag (e.g. "ko" for "ko-KR"); returns
 *  undefined (system default) when none matches, including when
 *  getVoices() hasn't finished loading yet (a well-known async quirk,
 *  not treated as an error — the utterance still speaks, just in
 *  whatever the browser's own default voice is). */
function pickVoiceForLocale(locale: UiLocale): SpeechSynthesisVoice | undefined {
  if (!isTtsSupported()) return undefined;
  const primarySubtag = SPEECH_LANG_BY_LOCALE[locale].split("-")[0].toLowerCase();
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith(primarySubtag));
}

type Props = {
  reflection: string | null;
  onRestart: () => void;
  hasHistory: boolean;
  onViewHistory: () => void;
  onGoHome: () => void;
  locale: UiLocale;
};

/**
 * Reflection — Page 2, Final Experience UI. AURINA greets you as Host
 * (enlarged portrait, independent of the frames below her) → 마음의
 * 거울, in a Reflection Frame → 마음이 머무는 곳, in a stronger Gift
 * Frame — each frame's visual weight rising toward the Gift, the one
 * thing AURINA hands back at the end of the session. History <-> Final
 * is a round trip (onViewHistory below), never a one-way exit: neither
 * button here clears session/history/reflection state (see
 * HriSession.tsx's handleViewHistory/handleGoHome vs handleRestart).
 *
 * Presentation only. mirror/sharing text is unchanged, real,
 * per-session output from controller.ts's Final Experience pipeline
 * (finalExperienceComposer.ts + finalExperiencePhraser.ts) via the
 * `<<<AURINA_HUMAN_SHARING>>>`-delimited `reflection` string — nothing
 * here generates, edits, or reorders that content.
 */
export default function Reflection({ reflection, onRestart, hasHistory, onViewHistory, onGoHome, locale }: Props) {
  const t = CONTENT[locale].reflection;
  const { mirror, sharing } = splitFinalExperience(reflection);
  const mirrorParagraphs = splitParagraphs(mirror);
  const sharingParagraphs = splitParagraphs(sharing);

  // Reflection Final View Position Fix — root cause was NOT this
  // component: AurinaSpace.tsx mounts a continuation <HriInput> right
  // after this section, which was inheriting HriInput's own
  // autoFocus=true default; browsers auto-scroll a newly-focused
  // element into view, and since that input sits below both Reflection
  // layers, the page landed on "마음이 머무는 곳" instead of the top of
  // this section every time Reflection appeared (see that fix too).
  // Disabling that autoFocus only removes the wrong scroll — it does
  // not, by itself, guarantee this section's own top is what's
  // visible (the page could simply stay wherever it happened to be
  // scrolled during the prior Conversation turn). This explicitly
  // scrolls THIS section's header into view, once, on mount, on both
  // desktop and mobile — instant (no smooth animation), since it is
  // establishing the correct starting position for a new view, not a
  // user-visible scroll gesture.
  const topRef = useRef<HTMLElement>(null);
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }, []);

  // Final Voice Reflection Gate (STEP V8) — reads exactly what this
  // component already renders to the user (mirrorParagraphs always;
  // sharingParagraphs only when that section actually renders — see
  // its own `sharingParagraphs.length > 0` guard above), in the same
  // top-to-bottom order. Never a second, independent read of
  // `reflection` — no internal-only data is spoken.
  const [ttsSupported] = useState(isTtsSupported);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Kept alive for the duration of playback — some engines (notably
  // WebKit/Safari, historically) silently drop an utterance if it gets
  // garbage-collected before speech finishes.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stopSpeaking = () => {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const startSpeaking = () => {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel(); // never overlap a previous utterance
    const spoken = [...mirrorParagraphs, ...sharingParagraphs].join(" ");
    if (!spoken.trim()) return;
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = SPEECH_LANG_BY_LOCALE[locale];
    const matchedVoice = pickVoiceForLocale(locale);
    if (matchedVoice) utterance.voice = matchedVoice;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Reflection unmounts on every navigation away from it (Home/Restart/
  // View History all change AurinaSpace's displayPhase, which remounts
  // the whole `.aurina-moment` subtree via its own `key` — see
  // AurinaSpace.tsx) — this alone is enough to guarantee speech is
  // cancelled on every one of those paths, no extra handler wiring.
  useEffect(() => {
    return () => {
      if (ttsSupported) window.speechSynthesis.cancel();
    };
  }, [ttsSupported]);

  return (
    <section className="reflection">
      <header ref={topRef} className="reflection-header reflection-fade" style={{ animationDelay: "0ms" }}>
        <div className="reflection-host">
          <img src={AURINA_ASSETS.finalHostImage} alt="AURINA" />
        </div>
        <div className="reflection-wordmark">AURINA</div>
        <h1 className="reflection-title">{t.title}</h1>
        <p className="reflection-subtitle">
          {t.subtitle}
        </p>
      </header>

      <section
        className="reflection-layer reflection-fade"
        style={{ animationDelay: "150ms" }}
        aria-labelledby="reflection-layer-1"
      >
        <h2 id="reflection-layer-1" className="reflection-section-title">
          {t.mirrorLabel}
        </h2>
        <div className="reflection-mirror-frame">
          <div className="reflection-mirror">
            {mirrorParagraphs.length > 0 ? (
              mirrorParagraphs.map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <p>{t.mirrorEmpty}</p>
            )}
          </div>
        </div>
      </section>

      {/* Beta Safe Reflection Baseline (Sprint 05) — sharing is now
          deterministically empty for every Beta session (controller.ts's
          BETA_SAFE_MIRROR_ONLY_REFLECTION), so unconditionally rendering
          this section produced the SAME giftEmpty placeholder sentence
          on every single Reflection — a real, visible artifact this
          section's copy was never written for (giftEmpty was authored
          as a rare fallback string, matching finalExperiencePhraser.ts's
          own rare empty-anchor template). Minimum fix: skip the whole
          section, not just its body, when there is nothing real to
          show — same "don't manufacture content to fill a slot"
          principle Sprint 05 applied everywhere else. Reversible by
          removing this one condition once sharing is reactivated
          post-Beta; nothing else in this component changed. */}
      {sharingParagraphs.length > 0 && (
        <section
          className="reflection-layer reflection-fade"
          style={{ animationDelay: "300ms" }}
          aria-labelledby="reflection-layer-2"
        >
          <h2 id="reflection-layer-2" className="reflection-section-title">
            {t.giftLabel}
          </h2>
          <div className="reflection-giftcard">
            <div className="reflection-giftcard-inner">
              <span className="reflection-giftcard-corner reflection-giftcard-corner--tl" aria-hidden="true" />
              <span className="reflection-giftcard-corner reflection-giftcard-corner--br" aria-hidden="true" />
              <span className="reflection-giftcard-mark" aria-hidden="true">“</span>
              <div className="reflection-giftcard-body">
                {sharingParagraphs.map((p, i) => <p key={i}>{p}</p>)}
              </div>
              <div className="reflection-giftcard-sign">AURINA</div>
            </div>
          </div>
        </section>
      )}

      {/* Final Voice Reflection Gate (STEP V8) — feature-detected and
          hidden entirely (never a disabled/dead button) when
          speechSynthesis is unsupported, or when there is nothing real
          to read (mirror still showing its own empty-state placeholder
          and no sharing section rendered) — same "don't manufacture
          content to fill a slot" principle as the sharing section's
          own guard above. */}
      {ttsSupported && (mirrorParagraphs.length > 0 || sharingParagraphs.length > 0) && (
        <section className="reflection-layer reflection-fade" style={{ animationDelay: "360ms" }}>
          <button
            type="button"
            className="arrival-chip arrival-chip--action"
            aria-pressed={isSpeaking}
            onClick={isSpeaking ? stopSpeaking : startSpeaking}
          >
            {isSpeaking ? t.stopVoice : t.listenVoice}
          </button>
        </section>
      )}

      {/* Final UI Gate §7 — two actions, deliberately unequal weight.
          "대화 다시 보기" is the more important navigation (real
          user words + AURINA's replies, nothing deleted by visiting
          it) so it gets the one filled pill on this screen. "다시
          대화하기" actually discards the session, so it's demoted to
          the same small text-link tier as "홈", never a second
          competing pill next to History. */}
      <section className="reflection-actions reflection-fade" style={{ animationDelay: "420ms" }}>
        {hasHistory && (
          <button type="button" className="reflection-history-btn" onClick={onViewHistory}>
            {t.viewHistory}
          </button>
        )}
        <div className="reflection-utility-row">
          <button type="button" className="aurina-utility-link" onClick={onGoHome}>
            {t.home}
          </button>
          <button type="button" className="aurina-utility-link aurina-utility-link--muted" onClick={onRestart}>
            {t.restartTalk}
          </button>
        </div>
      </section>
    </section>
  );
}

function splitParagraphs(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}
