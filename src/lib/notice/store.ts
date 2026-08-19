/**
 * Notice store — direct Neon CRUD. Same low-level patterns as
 * src/lib/observation/neonStorage.ts (neon(DATABASE_URL), graceful
 * persisted:false-shaped fallback when unconfigured, manual DDL only —
 * see schema.sql) but NOT that file's Adapter/Storage interface: that
 * shape exists to let an append-only, validate-then-record LOG swap
 * backends later. Notice is inherently CRUD-only and always
 * Neon-backed here, so a matching interface would be an unused
 * abstraction — Gate spec explicitly asks not to build a "복잡한
 * 게시판" or a new structure beyond what Notice actually needs.
 *
 * Every function fails soft (empty list / { ok:false } ) when
 * DATABASE_URL is unset or the query throws — a DB outage must never
 * break the Landing page or crash an admin action.
 */
import { neon } from "@neondatabase/serverless";
import type { Notice } from "./types";

const LANDING_NOTICE_LIMIT = 3;
const ADMIN_LIST_LIMIT = 100;

type NoticeRow = {
  id: number;
  title: string;
  body: string;
  is_published: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  published_at: string | Date | null;
};

function toIso(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toNotice(row: NoticeRow): Notice {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    isPublished: row.is_published,
    createdAt: toIso(row.created_at) as string,
    updatedAt: toIso(row.updated_at) as string,
    publishedAt: toIso(row.published_at),
  };
}

function client() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  return neon(connectionString);
}

/** Public read — Landing page. Most recently published first, capped
 *  (Gate §4: "최대 2~3개까지만 표시"). */
export async function listPublishedNotices(): Promise<Notice[]> {
  const sql = client();
  if (!sql) return [];
  try {
    const rows = (await sql`
      SELECT id, title, body, is_published, created_at, updated_at, published_at
      FROM notices
      WHERE is_published = true
      ORDER BY published_at DESC NULLS LAST, created_at DESC
      LIMIT ${LANDING_NOTICE_LIMIT}
    `) as NoticeRow[];
    return rows.map(toNotice);
  } catch {
    // A DB outage must never break the Landing page — same "fail
    // honestly, never interrupt the real product" rule as
    // NeonObservationStorage.
    return [];
  }
}

/** Admin read — includes unpublished, newest first. */
export async function listAllNotices(): Promise<{ notices: Notice[]; error: string | null }> {
  const sql = client();
  if (!sql) return { notices: [], error: "DATABASE_URL is not configured." };
  try {
    const rows = (await sql`
      SELECT id, title, body, is_published, created_at, updated_at, published_at
      FROM notices
      ORDER BY id DESC
      LIMIT ${ADMIN_LIST_LIMIT}
    `) as NoticeRow[];
    return { notices: rows.map(toNotice), error: null };
  } catch (error) {
    return { notices: [], error: error instanceof Error ? error.message : "Unknown query error" };
  }
}

export async function getNotice(id: number): Promise<Notice | null> {
  const sql = client();
  if (!sql) return null;
  try {
    const rows = (await sql`
      SELECT id, title, body, is_published, created_at, updated_at, published_at
      FROM notices WHERE id = ${id}
    `) as NoticeRow[];
    return rows[0] ? toNotice(rows[0]) : null;
  } catch {
    return null;
  }
}

export type NoticeWriteResult = { ok: true } | { ok: false; error: string };

export async function createNotice(title: string, body: string, isPublished: boolean): Promise<NoticeWriteResult> {
  const sql = client();
  if (!sql) return { ok: false, error: "DATABASE_URL is not configured." };
  try {
    // Plain JS-computed values, not a conditional SQL fragment — the
    // neon() tagged-template function does not support composing
    // nested sql`` fragments, so every branch is resolved before the
    // query is built, never inside it.
    const publishedAt = isPublished ? new Date().toISOString() : null;
    await sql`
      INSERT INTO notices (title, body, is_published, published_at)
      VALUES (${title}, ${body}, ${isPublished}, ${publishedAt})
    `;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown insert error" };
  }
}

export async function updateNotice(id: number, title: string, body: string, isPublished: boolean): Promise<NoticeWriteResult> {
  const sql = client();
  if (!sql) return { ok: false, error: "DATABASE_URL is not configured." };
  try {
    const existing = await getNotice(id);
    // Publishing for the first time (or re-publishing after a prior
    // unpublish) refreshes published_at so "최신 공개 공지 우선" sorting
    // reflects when it actually became visible again; staying
    // published across an edit does not reset it. Resolved in JS, same
    // reason as createNotice above.
    const justPublished = isPublished && !(existing?.isPublished ?? false);
    const publishedAt = justPublished ? new Date().toISOString() : (existing?.publishedAt ?? null);
    await sql`
      UPDATE notices
      SET title = ${title}, body = ${body}, is_published = ${isPublished}, updated_at = now(), published_at = ${publishedAt}
      WHERE id = ${id}
    `;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown update error" };
  }
}

export async function setPublished(id: number, isPublished: boolean): Promise<NoticeWriteResult> {
  const sql = client();
  if (!sql) return { ok: false, error: "DATABASE_URL is not configured." };
  try {
    if (isPublished) {
      await sql`UPDATE notices SET is_published = true, published_at = now(), updated_at = now() WHERE id = ${id}`;
    } else {
      await sql`UPDATE notices SET is_published = false, updated_at = now() WHERE id = ${id}`;
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown update error" };
  }
}

export async function deleteNotice(id: number): Promise<NoticeWriteResult> {
  const sql = client();
  if (!sql) return { ok: false, error: "DATABASE_URL is not configured." };
  try {
    await sql`DELETE FROM notices WHERE id = ${id}`;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown delete error" };
  }
}
