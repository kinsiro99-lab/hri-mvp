import Link from "next/link";
import { notFound } from "next/navigation";
import { getAd } from "@/lib/ads/data";
import { resolveAdContent, AD_LOCALES, type AdLocale } from "@/lib/ads/types";

const AD_BADGE_LABEL = "AD";

// Visible Advertising Spaces Gate §5 — a minimal per-locale label for
// the one piece of chrome this page owns itself (the ad content's own
// title/description/CTA/disclaimer are already locale-resolved via
// resolveAdContent). Not a new localization system — just this one
// string, same ko-fallback contract as resolveAdContent itself.
const BACK_TO_HRI_LABEL: Partial<Record<AdLocale, string>> = {
  ko: "HRI로 돌아가기",
  ja: "HRIに戻る",
  en: "Back to HRI",
  fr: "Retour à HRI",
  "zh-CN": "返回 HRI",
  "zh-HK": "返回 HRI",
  "zh-TW": "返回 HRI",
};

/**
 * Ad Structure V1 Gate §7 — dedicated Full-page/Landing ad route. Not
 * a new design: reuses the same tokens (--bg-panel, --ink-1..4, --gold)
 * ClosedNotice/not-found.tsx already use for a bare, undecorated page.
 *
 * Only renders an ad that is: found by id, active, and type "full-page"
 * — any other case (unknown id, inactive, or a card/banner id visited
 * here) is a plain 404, never a broken or blank ad. No sample/full-page
 * ad exists yet, so this route 404s for every id today; that's the
 * correct behavior until a real one is added to src/lib/ads/data.ts.
 */
export default function AdPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { locale?: string };
}) {
  const ad = getAd(params.id);
  if (!ad || !ad.active || ad.type !== "full-page") {
    notFound();
  }

  const locale: AdLocale = AD_LOCALES.includes(searchParams.locale as AdLocale)
    ? (searchParams.locale as AdLocale)
    : "ko";
  const content = resolveAdContent(ad, locale);
  if (!content) {
    notFound();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "560px",
          width: "100%",
          background: "var(--bg-panel)",
          borderRadius: "18px",
          padding: "32px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            marginBottom: "16px",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "var(--ink-4)",
            border: "1px solid var(--border-soft)",
            borderRadius: "4px",
            padding: "1px 5px",
          }}
        >
          {AD_BADGE_LABEL}
        </div>
        {ad.image && (
          <img
            src={ad.image}
            alt=""
            style={{
              width: "100%",
              borderRadius: "12px",
              marginBottom: "24px",
              display: "block",
            }}
          />
        )}
        <h1 style={{ color: "var(--ink-1)", fontSize: "24px", fontWeight: 700, margin: "0 0 12px" }}>
          {content.title}
        </h1>
        {content.description && (
          <p style={{ color: "var(--ink-3)", fontSize: "15px", lineHeight: 1.6, margin: "0 0 24px", whiteSpace: "pre-line" }}>
            {content.description}
          </p>
        )}
        {content.ctaLabel &&
          (ad.destination ? (
            <a
              href={ad.destination}
              style={{
                display: "inline-block",
                padding: "12px 28px",
                borderRadius: "999px",
                background: "var(--gold)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "14px",
                textDecoration: "none",
              }}
            >
              {content.ctaLabel}
            </a>
          ) : (
            <span
              aria-disabled="true"
              style={{
                display: "inline-block",
                padding: "12px 28px",
                borderRadius: "999px",
                border: "1px solid var(--border-soft)",
                color: "var(--ink-4)",
                fontWeight: 700,
                fontSize: "14px",
              }}
            >
              {content.ctaLabel}
            </span>
          ))}
        {content.disclaimer && (
          <p style={{ color: "var(--ink-4)", fontSize: "11px", lineHeight: 1.5, marginTop: "24px" }}>
            {content.disclaimer}
          </p>
        )}
        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: "20px",
            fontSize: "13px",
            color: "var(--ink-3)",
            textDecoration: "underline",
          }}
        >
          {BACK_TO_HRI_LABEL[locale] ?? BACK_TO_HRI_LABEL.ko}
        </Link>
      </div>
    </div>
  );
}
