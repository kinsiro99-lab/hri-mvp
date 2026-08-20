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
