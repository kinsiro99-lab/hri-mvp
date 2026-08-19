"use server";

/**
 * Notice admin write actions — Server Actions, not a REST API. Chosen
 * to match the existing admin surface (plain server-rendered
 * <form>/page.tsx, no client-side fetch layer anywhere in /admin) and
 * because it is the simplest possible "제목/내용/공개여부/저장" path
 * (Gate §1): a plain HTML form POST, no new client JS, no new auth
 * header scheme.
 *
 * Security (Gate §8): every action re-verifies ADMIN_ACCESS_KEY itself
 * from a hidden `key` form field — never trusts that the page that
 * rendered the form was already authorized, since a Server Action is
 * its own server-side entry point and must not assume its caller was
 * gated correctly.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createNotice, deleteNotice, setPublished, updateNotice } from "@/lib/notice/store";

function isAuthorized(providedKey: FormDataEntryValue | null): boolean {
  const accessKey = process.env.ADMIN_ACCESS_KEY;
  return Boolean(accessKey) && providedKey === accessKey;
}

function backTo(key: FormDataEntryValue | null): never {
  redirect(`/admin/notices?key=${encodeURIComponent(String(key ?? ""))}`);
}

function afterWrite(key: FormDataEntryValue | null) {
  // Public Landing (/) is force-dynamic already (no ISR to bust), but
  // /admin/notices itself can be cached by the router between actions
  // in the same session — revalidate so the list reflects the write
  // immediately, matching Gate §10's "즉시 확인" requirement.
  revalidatePath("/admin/notices");
  revalidatePath("/");
  backTo(key);
}

export async function createNoticeAction(formData: FormData) {
  const key = formData.get("key");
  if (!isAuthorized(key)) redirect("/admin/notices");

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const isPublished = formData.get("isPublished") === "on";
  if (!title || !body) backTo(key);

  await createNotice(title, body, isPublished);
  afterWrite(key);
}

export async function updateNoticeAction(formData: FormData) {
  const key = formData.get("key");
  if (!isAuthorized(key)) redirect("/admin/notices");

  const id = Number(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const isPublished = formData.get("isPublished") === "on";
  if (!Number.isInteger(id) || !title || !body) backTo(key);

  await updateNotice(id, title, body, isPublished);
  afterWrite(key);
}

export async function togglePublishAction(formData: FormData) {
  const key = formData.get("key");
  if (!isAuthorized(key)) redirect("/admin/notices");

  const id = Number(formData.get("id"));
  const nextPublished = formData.get("nextPublished") === "true";
  if (!Number.isInteger(id)) backTo(key);

  await setPublished(id, nextPublished);
  afterWrite(key);
}

export async function deleteNoticeAction(formData: FormData) {
  const key = formData.get("key");
  if (!isAuthorized(key)) redirect("/admin/notices");

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) backTo(key);

  await deleteNotice(id);
  afterWrite(key);
}
