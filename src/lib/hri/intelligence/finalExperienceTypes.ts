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
import type { PresentReality } from "./presentReality";

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

/**
 * HRI REFLECTION DISCOVERY Gate — the four ways this session's already-
 * computed material can legitimately point beyond plain Explicit
 * content, per the approved REFLECTION BOUNDARY design (Explicit/
 * Emergent allowed, Invented never). Each is read off a signal this
 * file already computes for another reason — no new marker list, no
 * new LLM call:
 *   "relation"  — relations.length > 0 (a real validated ContextRelation).
 *   "change"    — some active element was reinforced by more than one
 *                 turn's evidence (the same thing recurring/shifting).
 *   "structure" — hasTension (conflictsWith/limits or lexical contrast)
 *                 — a friction in the situation itself, not necessarily
 *                 a feeling.
 *   "open"      — unresolvedReasons is non-empty.
 * Empty means explicit-only: nothing recurring, contrasting, related,
 * or left open this session — staying with what was literally said is
 * the correct, complete outcome, not a shortfall.
 */
export type DiscoverySignal = "relation" | "change" | "structure" | "open";

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
  /** HRI REFLECTION DISCOVERY Gate — see DiscoverySignal's own doc.
   *  Permission for a direction, never an obligation — the phraser
   *  prompt (finalExperiencePhraser.ts) must frame it that way. */
  discoverySignals: DiscoverySignal[];
  /** Living Mirror Expression Authority Gate — the same pure projection
   *  presentReality.ts already computes off the raw ContextGraph +
   *  EvidenceItem[] this function receives, carried through unchanged so
   *  Layer 1 (mirror) can read it without finalExperiencePhraser.ts ever
   *  needing the raw graph/evidence itself. Zero new computation here —
   *  see finalExperienceComposer.ts's own call site. */
  presentReality: PresentReality;
};

export type FinalExperienceResult = {
  mirror: string;
  sharing: string;
};
