/**
 * Notice — operator-authored Landing announcements. Deliberately NOT
 * an ObservationEvent-shaped record (see src/lib/observation/types.ts)
 * — Notice is admin-editable content with an identity and a lifecycle
 * (create/update/publish/unpublish/delete), Observation is an
 * append-only system log. Kept in a separate table and a separate
 * module on purpose (Notice System Gate §2/§9).
 *
 * Multilingual Notice Gate — one Notice identity, not 7 per-locale
 * rows: `title`/`body` stay the ko-authoritative master (unchanged,
 * Production content preserved), and `translations` holds only the
 * 6 non-ko locales — ko is never duplicated inside it. Same shape as
 * `HriAd.content`/`resolveAdContent` in src/lib/ads/types.ts on
 * purpose, so this isn't a new pattern in the codebase, just Notice
 * catching up to what Ads already does.
 */
export type NoticeLocale = "ja" | "en" | "fr" | "zh-CN" | "zh-HK" | "zh-TW";

export type NoticeTranslation = {
  title: string;
  body: string;
};

export type NoticeTranslations = Partial<Record<NoticeLocale, NoticeTranslation>>;

export type Notice = {
  id: number;
  title: string;
  body: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  /** Non-ko locale overrides only. null/undefined/missing-locale/
   *  incomplete-entry all fall back to title/body — see
   *  resolveNoticeContent below. */
  translations?: NoticeTranslations | null;
};

/**
 * Resolves the notice content to show for `locale` — ko (or any
 * locale outside NoticeLocale, i.e. this app's UiLocale minus ko)
 * always reads title/body directly; any other locale reads its
 * translations[locale] entry only if BOTH title and body are present
 * and non-empty, otherwise falls back to title/body. Never throws,
 * never returns blank fields — matches resolveAdContent's ko-fallback
 * contract in src/lib/ads/types.ts.
 */
export function resolveNoticeContent(
  notice: Notice,
  locale: string,
): NoticeTranslation {
  const fallback: NoticeTranslation = { title: notice.title, body: notice.body };
  if (locale === "ko") return fallback;

  const translation = notice.translations?.[locale as NoticeLocale];
  if (translation && translation.title && translation.body) {
    return translation;
  }
  return fallback;
}
