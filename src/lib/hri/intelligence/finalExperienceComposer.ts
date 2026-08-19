/**
 * Gate 31 — AURINA Final Experience, deterministic grounding selection.
 *
 * This file makes ZERO judgment about wording — it only selects and
 * shapes already-grounded material (verbatim Evidence, already-
 * validated ContextGraph elements/relations/unresolved) into the input
 * the phraser (finalExperiencePhraser.ts) is allowed to speak from.
 * Matches the codebase's existing decision/wording split
 * (intelligenceCore.ts's decideResponse vs responsePhraser.ts) — WHAT
 * is groundable is decided here, deterministically; HOW to say it is
 * the phraser's job, never the reverse.
 */
import type { EvidenceItem } from "../v2/questionCorePrototype";
import type { ContextGraph } from "../context/types";
import type { FinalExperienceGrounding } from "./finalExperienceTypes";

/** Local copy of reflectionComposer.ts's CONTRAST_MARKERS — same
 *  precedent as responsePhraser.ts's PRESUMPTION_MARKERS ("reused
 *  verbatim" as an intentional small local copy, not a cross-file
 *  import, to keep this Gate's blast radius inside intelligence/). */
const CONTRAST_MARKERS = ["하지만", "그렇지만", "그러나", "반면", "그래도"];

function hasLexicalContrast(texts: string[]): boolean {
  return texts.some((t) => CONTRAST_MARKERS.some((m) => t.includes(m)));
}

export function buildFinalExperienceGrounding(
  evidence: EvidenceItem[] | undefined,
  graph: ContextGraph | undefined,
  turnCount: number,
): FinalExperienceGrounding {
  const activeEvidence = (evidence ?? []).filter((e) => e.status === "active");
  const verbatimEvidence = [...new Set(activeEvidence.map((e) => e.text.trim()).filter(Boolean))];

  const g = graph ?? { elements: [], relations: [], unresolved: [], updateLog: [] };
  const activeElements = g.elements.filter((e) => e.active);
  const elements = activeElements.map((e) => ({
    id: e.id,
    kind: e.kind,
    description: e.description,
    status: e.status,
    confidence: e.confidence,
  }));

  const activeIds = new Set(activeElements.map((e) => e.id));
  const relations = g.relations
    .filter((r) => r.status !== "resolved" && activeIds.has(r.from) && activeIds.has(r.to))
    .map((r) => {
      const from = activeElements.find((e) => e.id === r.from);
      const to = activeElements.find((e) => e.id === r.to);
      return { type: r.type, fromDescription: from?.description ?? "", toDescription: to?.description ?? "" };
    })
    .filter((r) => r.fromDescription && r.toDescription);

  const unresolvedReasons = g.unresolved.map((u) => u.reason).filter(Boolean);

  const hasTension =
    relations.some((r) => r.type === "conflictsWith" || r.type === "limits") ||
    activeElements.some((e) => e.status === "conflicted") ||
    hasLexicalContrast(verbatimEvidence);

  return { verbatimEvidence, elements, relations, unresolvedReasons, hasTension, turnCount };
}
