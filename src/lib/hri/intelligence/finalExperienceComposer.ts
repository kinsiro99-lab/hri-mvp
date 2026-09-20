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
import type { DiscoverySignal, FinalExperienceGrounding } from "./finalExperienceTypes";
import type { Locale } from "../locale";
import { buildPresentReality } from "./presentReality";

/** Local copy of reflectionComposer.ts's CONTRAST_MARKERS — same
 *  precedent as responsePhraser.ts's PRESUMPTION_MARKERS ("reused
 *  verbatim" as an intentional small local copy, not a cross-file
 *  import, to keep this Gate's blast radius inside intelligence/).
 *  Multilingual Gate — Japanese contrast markers added separately,
 *  Korean list byte-preserved. Soft tension-detection signal only
 *  (hasTension also has other, structural sources — see below), so a
 *  first-pass Japanese list is safe even without empirical tuning yet. */
const CONTRAST_MARKERS: Record<Locale, string[]> = {
  ko: ["하지만", "그렇지만", "그러나", "반면", "그래도"],
  ja: ["しかし", "でも", "だが", "一方で", "それでも", "けれど", "けれども"],
  en: ["but", "however", "although", "even though", "still", "yet"],
  // 7-Locale Runtime Output Support Gate — same soft tension-detection
  // role as ko/ja/en above, not empirically tuned yet.
  fr: ["mais", "cependant", "pourtant", "bien que", "même si", "toutefois"],
  "zh-CN": ["但是", "可是", "然而", "不过", "尽管"],
  "zh-HK": ["但是", "可是", "然而", "不過", "儘管"],
  "zh-TW": ["但是", "可是", "然而", "不過", "儘管"],
};

function hasLexicalContrast(texts: string[], locale: Locale): boolean {
  const cmp = locale === "en" ? texts.map((t) => t.toLowerCase()) : texts;
  return cmp.some((t) => CONTRAST_MARKERS[locale].some((m) => t.includes(m)));
}

export function buildFinalExperienceGrounding(
  evidence: EvidenceItem[] | undefined,
  graph: ContextGraph | undefined,
  turnCount: number,
  locale: Locale,
): FinalExperienceGrounding {
  const activeEvidence = (evidence ?? []).filter((e) => e.status === "active");
  // HRI Architecture Fix Gate — a bare confirmation ("그래"/"응"/"네" and
  // equivalents, tagged act:"confirmation" at Evidence-creation time in
  // questionCorePrototype.ts) is stored (raw turns are never dropped) but
  // is not semantic content of its own — it must not appear as if it
  // were a fresh disclosure the Final Experience can ground new material
  // in. Structural exclusion here, not a marker re-check.
  const verbatimEvidence = [...new Set(activeEvidence.filter((e) => e.act !== "confirmation").map((e) => e.text.trim()).filter(Boolean))];

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
    hasLexicalContrast(verbatimEvidence, locale);

  // HRI REFLECTION DISCOVERY Gate — each condition reuses a value
  // already computed above for another reason (see DiscoverySignal's
  // own doc in finalExperienceTypes.ts for what each one means and
  // why). "change" is the one genuinely new read: activeElements here
  // (unlike the `elements` projection above) still carries the raw
  // ContextElement.evidenceRefs, so ">= 2" is just reading data the
  // graph already tracked, not a new classifier.
  const discoverySignals: DiscoverySignal[] = [];
  if (relations.length > 0) discoverySignals.push("relation");
  if (activeElements.some((e) => e.evidenceRefs.length >= 2)) discoverySignals.push("change");
  if (hasTension) discoverySignals.push("structure");
  if (unresolvedReasons.length > 0) discoverySignals.push("open");

  // Living Mirror Expression Authority Gate — pure projection, computed
  // from the exact same (graph, evidence) this function already
  // received; presentReality.ts itself is unchanged. g/evidence here are
  // already-defaulted (g above, `evidence ?? []` here) so buildPresentReality
  // never sees undefined.
  const presentReality = buildPresentReality(g, evidence ?? []);

  return { verbatimEvidence, elements, relations, unresolvedReasons, hasTension, turnCount, discoverySignals, presentReality };
}
