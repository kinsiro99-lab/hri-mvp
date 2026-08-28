/**
 * HRI Ad Structure V1 — shared data shape for every ad placement
 * (Banner / Card / Full-page) across every ad-capable locale. This is
 * a structural migration only: the first real consumer is Arrival.tsx's
 * RcAdCard (see src/lib/ads/data.ts for the actual RC entry). Not
 * connected to Observation/Reflection in any way — ads never read
 * session content and are never targeted by conversation/Reality
 * Point (HRI/RC Independence, Ad Structure V1 Gate §8).
 */

export type AdType = "banner" | "card" | "full-page";

// Ad-capable locales are a superset of the app's UI Locale (ko/ja/en,
// see src/lib/hri/locale.ts) — zh-CN/zh-HK/zh-TW have no UI copy yet,
// only ad copy is expected to exist for them first.
// French Locale Gate — fr added to stay a superset of UiLocale (which
// now includes fr); Arrival.tsx calls resolveAdContent with a plain
// UiLocale value, so this union must never fall behind it.
export const AD_LOCALES = ["ko", "ja", "en", "fr", "zh-CN", "zh-HK", "zh-TW"] as const;
export type AdLocale = (typeof AD_LOCALES)[number];

export type AdContent = {
  title: string;
  description?: string;
  ctaLabel?: string;
  imageLine1?: string;
  imageLine2?: string;
  disclaimer?: string;
};

export type HriAd = {
  id: string;
  type: AdType;
  active: boolean;
  image?: string;
  /** Click-through URL. Left undefined while a real destination isn't
   *  confirmed yet — consumers must keep any CTA disabled in that case,
   *  never invent a placeholder URL. */
  destination?: string;
  content: Partial<Record<AdLocale, AdContent>>;
  startAt?: string;
  endAt?: string;
};

/**
 * Beta Locale Fallback Gate — only `ko` copy exists for any ad today;
 * no ja/en/zh-CN/zh-HK/zh-TW translation has been written yet. Until
 * an ad's `content[locale]` is actually filled in, every other locale
 * reads the `ko` entry instead of showing missing/blank text. This is
 * a temporary Beta behavior, not a permanent design choice — as each
 * locale's real copy is written, it naturally stops falling back.
 */
export function resolveAdContent(ad: HriAd, locale: AdLocale): AdContent | undefined {
  return ad.content[locale] ?? ad.content.ko;
}
