/**
 * Gate 31 — AURINA Final Experience. Shared, dependency-free types and
 * the wire-format marker both controller.ts (server) and Reflection.tsx
 * (client component) import.
 *
 * Why a marker inside ReflectionOutput.text instead of a new field on
 * ReflectionOutput/HriEvent: the "reflection" HriEvent
 * (events.ts:createReflectionEvent) only ever carries a single `text`
 * string, and that same string is the one thing threaded, unchanged in
 * shape, through sessionAdapter.ts -> hriRuntime.ts -> HriSession.tsx ->
 * AurinaSpace.tsx -> Reflection.tsx. Widening that contract would touch
 * five files outside this Gate's scope for a purely mechanical reason.
 * Encoding both layers into the one string this Gate already owns (with
 * a marker no real user/LLM sentence would ever produce) keeps the
 * change local to controller.ts (producer) and Reflection.tsx
 * (consumer) — everything in between is untouched, byte-for-byte.
 */

/** Never emitted by the phraser prompt, never plausible user/LLM prose. */
export const FINAL_EXPERIENCE_MARKER = "\n\n<<<AURINA_HUMAN_SHARING>>>\n\n";

export function splitFinalExperience(text: string | null): { mirror: string; sharing: string } {
  if (!text) return { mirror: "", sharing: "" };
  const idx = text.indexOf(FINAL_EXPERIENCE_MARKER);
  if (idx === -1) return { mirror: text, sharing: "" };
  return {
    mirror: text.slice(0, idx).trim(),
    sharing: text.slice(idx + FINAL_EXPERIENCE_MARKER.length).trim(),
  };
}

export function joinFinalExperience(mirror: string, sharing: string): string {
  return sharing ? `${mirror}${FINAL_EXPERIENCE_MARKER}${sharing}` : mirror;
}

/**
 * Deterministic, already-grounded material handed to the phraser. Every
 * string here is either a literal user quote (verbatimEvidence,
 * ContextElement.description when isStillVerbatim) or a value already
 * validated by ../context/validator.ts's V1-V10 grounding rules
 * (ContextGraph elements/relations/unresolved) — nothing here is
 * invented by this composer. Selection is deterministic (array
 * order/filters only, see finalExperienceComposer.ts); the phraser's
 * job is expression, never fact selection.
 */
export type FinalExperienceElement = {
  id: string;
  kind: "situation" | "direction" | "constraint" | "response";
  description: string;
  status: string;
  confidence: number;
};

export type FinalExperienceRelation = {
  type: string;
  fromDescription: string;
  toDescription: string;
};

export type FinalExperienceGrounding = {
  /** Every active Evidence item's literal text, oldest first, deduped. */
  verbatimEvidence: string[];
  /** Active ContextGraph elements — the deepest available Understanding. */
  elements: FinalExperienceElement[];
  /** Relations between two active elements — the only legitimate source
   *  for naming a tension/contrast without inventing one. */
  relations: FinalExperienceRelation[];
  /** Open questions the session never resolved — named honestly if at
   *  all, never resolved into a false conclusion. */
  unresolvedReasons: string[];
  /** True when at least one relation is conflictsWith/limits, or an
   *  element's own status is "conflicted" — the only structural signal
   *  allowed to justify Human Sharing naming a tension (Gate 31 §6). */
  hasTension: boolean;
  turnCount: number;
};

export type FinalExperienceResult = {
  mirror: string;
  sharing: string;
};
