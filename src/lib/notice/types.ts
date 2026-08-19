/**
 * Notice — operator-authored Landing announcements. Deliberately NOT
 * an ObservationEvent-shaped record (see src/lib/observation/types.ts)
 * — Notice is admin-editable content with an identity and a lifecycle
 * (create/update/publish/unpublish/delete), Observation is an
 * append-only system log. Kept in a separate table and a separate
 * module on purpose (Notice System Gate §2/§9).
 */
export type Notice = {
  id: number;
  title: string;
  body: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};
