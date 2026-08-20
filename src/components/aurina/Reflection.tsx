import { AURINA_ASSETS } from "./assets";
import { splitFinalExperience } from "../../lib/hri/intelligence/finalExperienceTypes";
import type { Locale } from "@/lib/hri/locale";
import { CONTENT } from "@/lib/i18n/content";
import "./aurina.css";

type Props = {
  reflection: string | null;
  onRestart: () => void;
  hasHistory: boolean;
  onViewHistory: () => void;
  onGoHome: () => void;
  locale: Locale;
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

  return (
    <section className="reflection">
      <header className="reflection-header reflection-fade" style={{ animationDelay: "0ms" }}>
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
              {sharingParagraphs.length > 0 ? (
                sharingParagraphs.map((p, i) => <p key={i}>{p}</p>)
              ) : (
                <p>{t.giftEmpty}</p>
              )}
            </div>
            <div className="reflection-giftcard-sign">AURINA</div>
          </div>
        </div>
      </section>

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
