/**
 * HRI Multilingual Gate — Japanese, then English. Single shared Locale
 * type, explicit and threaded (never inferred from content). Korean
 * remains the default/master locale (Beta Handoff §1): any caller that
 * does not pass a recognized locale value resolves to "ko", matching
 * this codebase's existing fail-toward-known-behavior convention (e.g.
 * SITE_ACCESS_MODE in page.tsx).
 */
export type Locale = "ko" | "ja" | "en";

export const DEFAULT_LOCALE: Locale = "ko";

export function resolveLocale(value: unknown): Locale {
  if (value === "ja" || value === "en") return value;
  return "ko";
}

/**
 * Multilingual Localization Gate — UI-only display locale, a superset
 * of the Runtime's `Locale` above (ko/ja/en). Added so Landing/fixed
 * UI/Benefits/Notice/Advertising copy can be fully localized for
 * zh-CN/zh-HK/zh-TW without touching Runtime: nothing above this line
 * changes, and no Runtime file imports `UiLocale`/`toEngineLocale` —
 * only UI components (HriSession.tsx and below) and src/lib/i18n do.
 *
 * French Locale Gate — `fr` added the same way: UI-only, no Runtime
 * French support exists (see toEngineLocale below), so it maps to en
 * at the same single call site as zh-CN/zh-HK/zh-TW already do.
 */
export const UI_LOCALES = ["ko", "ja", "en", "fr", "zh-CN", "zh-HK", "zh-TW"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

/**
 * Maps a display locale down to a Runtime-supported one, at the UI/
 * session boundary only (HriSession.tsx's callEngine call). Runtime
 * has no Chinese/French SYSTEM_PROMPT/safety-marker/validator support
 * yet (extending it is out of this Gate's scope), so zh-CN/zh-HK/
 * zh-TW/fr users see fully localized UI chrome, but AURINA's actual
 * generated questions/Reflection text come back in English — a
 * disclosed Beta limitation, not a bug.
 */
export function toEngineLocale(locale: UiLocale): Locale {
  if (locale === "ja" || locale === "en" || locale === "ko") return locale;
  return "en";
}
