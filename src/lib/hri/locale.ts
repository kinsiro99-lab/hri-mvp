/**
 * HRI 7-Locale Runtime Output Support Gate — widens Locale from ko/ja/en
 * to the full UI locale set (ko/ja/en/fr/zh-CN/zh-HK/zh-TW). Prior to
 * this Gate, `Locale` and `UiLocale` were deliberately different sets
 * (Runtime only understood 3; UI displayed 7, collapsing the other 4 to
 * English at toEngineLocale — see that function's own doc below for
 * what this Gate replaces). They are now the SAME set: every UI locale
 * is a real Runtime output locale. Korean remains the default/master
 * locale (Beta Handoff §1): any caller that does not pass a recognized
 * locale value resolves to "ko", matching this codebase's existing
 * fail-toward-known-behavior convention (e.g. SITE_ACCESS_MODE in
 * page.tsx) — unchanged by this Gate.
 */
export const UI_LOCALES = ["ko", "ja", "en", "fr", "zh-CN", "zh-HK", "zh-TW"] as const;
export type Locale = (typeof UI_LOCALES)[number];
/** Kept as an alias, not a separate type, so existing UI-side imports of
 *  `UiLocale` (HriSession.tsx and below, src/lib/i18n) keep working
 *  unchanged — before this Gate it was a genuinely wider type than
 *  `Locale`; now the two sets are identical by definition. */
export type UiLocale = Locale;

export const DEFAULT_LOCALE: Locale = "ko";

export function resolveLocale(value: unknown): Locale {
  return typeof value === "string" && (UI_LOCALES as readonly string[]).includes(value) ? (value as Locale) : "ko";
}

/**
 * 7-Locale Runtime Output Support Gate — before this Gate, this function
 * collapsed zh-CN/zh-HK/zh-TW/fr down to "en" at the UI/session boundary
 * (HriSession.tsx's callEngine call), destroying the user's actual
 * selection before it ever reached the server — the confirmed root
 * cause of the "Chinese UI, Chinese input, English Reflection" release-
 * blocking defect. Now that `Locale` IS `UiLocale`, this is a pure
 * identity function — kept (rather than removing the call site in
 * HriSession.tsx) so that call site's diff stays zero-width; every
 * locale the user can select now reaches the Runtime unchanged.
 */
export function toEngineLocale(locale: UiLocale): Locale {
  return locale;
}
