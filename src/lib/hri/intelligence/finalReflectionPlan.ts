/**
 * HRI Architecture Fix Gate — Reflection Plan.
 *
 * Sits between the deterministic FinalExperienceGrounding
 * (finalExperienceComposer.ts — unchanged in shape by this Gate) and
 * the phraser (finalExperiencePhraser.ts). Pure selection, no LLM call,
 * no new marker list: narrows the full grounding down to ONE preferred
 * discovery direction plus a small set of REAL verbatim anchors, so the
 * phraser's freedom is about HOW to say it, never WHAT pile of material
 * to pick from — closing the gap the Architecture Audit found between
 * "free generation" and a content-blind fallback.
 *
 * Anchor precision (Design Gate correction #2): ContextElement/
 * ContextRelation's own evidenceRefs[].sourceText is a string the
 * Semantic Interpreter (an LLM, contextFirstSemanticAdapter.ts) wrote
 * when it PROPOSED that element/relation — it is not the user's literal
 * words, even though it is meant to summarize them. This file never
 * treats .sourceText as verbatim. It only ever reads evidenceRefs[].turn
 * as a pointer, then looks up that turn's REAL text in the raw
 * EvidenceItem[] (prototypeEvidence) — the one place actual user words
 * are stored unmodified — and only when that item's act is not
 * "confirmation" (Design Gate part A: a bare "그래" is never a valid
 * anchor for new material).
 *
 * Preferred-not-forced (Design Gate correction #1): every discovery
 * direction below requires a REAL resolved anchor. If none can be
 * found, this moves to the next direction in priority order, and
 * finally to "explicit-only" — it never fabricates or stretches for an
 * anchor just to keep a "richer" discovery type alive. The phraser
 * prompt (finalExperiencePhraser.ts) additionally frames whatever
 * direction IS returned here as a preference, not an obligation, so a
 * thin connection can still be declined by the model itself.
 */
import type { EvidenceItem } from "../v2/questionCorePrototype";
import type { ContextGraph, ContextElement, RelationType, RelationProvenance } from "../context/types";
import type { DiscoverySignal, FinalExperienceGrounding } from "./finalExperienceTypes";

export type ReflectionPlan = {
  /** Full grounding, unchanged — still shown to the phraser for context.
   *  This Plan narrows what's PREFERRED, never what's visible. */
  grounding: FinalExperienceGrounding;
  /** Real, verbatim EvidenceItem text only (never a ContextGraph
   *  paraphrase) — see this file's own doc above. Empty only when the
   *  session has no active, non-confirmation evidence at all. */
  anchorEvidence: string[];
  primaryDiscovery: DiscoverySignal | "explicit-only";
  /** Only set when primaryDiscovery is "relation" or "structure". */
  primaryRelationType?: RelationType;
  /** User-Stated Relation Gate — only set when primaryDiscovery is
   *  "relation" (tryStructure's own relation branch is untouched by this
   *  Gate — see its own doc for why hasTension's lexical-contrast case
   *  has no real ContextRelation, hence no provenance, behind it).
   *  Passed straight through from the winning ContextRelation, never
   *  re-derived here. See RelationProvenance's own doc for what "user-
   *  stated" does and does not mean — never objective/world causality. */
  primaryRelationProvenance?: RelationProvenance;
  /** Only set when primaryDiscovery is "open". Kept for audit/devLog
   *  only — Grounded Discovery Layer Gate: NEVER read by
   *  finalExperiencePhraser.ts any more (see groundedDiscovery below),
   *  since this is HRI-authored free text (the interpreter's own
   *  unresolvedReason), not literal user evidence, and must not be
   *  shown to the phraser with the same authority as anchorEvidence. */
  unresolvedFocus?: string;
  /** Grounded Discovery Layer Gate — additive. A minimal, deterministic
   *  reframing of the fields above (kind/evidence renamed and
   *  reorganized, nothing new computed except coreClaim/provenance/
   *  latitude — see buildGroundedDiscovery below) that
   *  finalExperiencePhraser.ts now reads instead of the raw fields
   *  above directly. Every field here is derived ONLY from data this
   *  file already computed for the same reasons as before this Gate —
   *  no new LLM call, no keyword table, no ContextGraph change. */
  groundedDiscovery: GroundedDiscovery;
};

/**
 * Grounded Discovery Layer Gate.
 *
 * Separates DISCOVERY AUTHORITY (what must remain true — fixed here,
 * deterministically, before the phraser ever runs) from EXPRESSION
 * FREEDOM (how naturally to say it — left to the phraser, calibrated by
 * `latitude`). `coreClaim` is a semantic invariant to satisfy, never
 * mandatory final wording, a sentence template, or a lexical
 * containment boundary — see finalExperiencePhraser.ts's own use of it
 * for how that distinction is enforced in the prompt.
 */
export type GroundedDiscoveryKind = "EXPLICIT" | "RELATION" | "CHANGE" | "STRUCTURE" | "UNRESOLVED";

/** USER_EXPLICIT: the coreClaim traces to the user's own act of stating
 *  it (either the evidence IS the whole claim, kind=EXPLICIT; or a
 *  ContextRelation the user themselves connected, provenance="user-
 *  stated" — see RelationProvenance's own doc). STRUCTURALLY_DERIVED:
 *  HRI's own reading (an inferred relation, a recurrence, a structural
 *  tension, an open question) — real and evidence-grounded, but not
 *  something the user asserted in these words. */
export type GroundedDiscoveryProvenance = "USER_EXPLICIT" | "STRUCTURALLY_DERIVED";

/** Deterministic, from kind+provenance only (see
 *  computeGroundedDiscoveryLatitude below) — never from a raw
 *  confidence number, which CONTEXT_CONFIDENCE_POLICY's own doc
 *  documents as provisional/unmeasured (confidencePolicy.ts). HIGH is
 *  reached only when the user's own words already supply the entire
 *  claim (kind=EXPLICIT, provenance=USER_EXPLICIT) — there is no
 *  unclaimed content left for extra warmth to fill, so richer
 *  expression is safe specifically there, not as a general reward for
 *  "strong" evidence. */
export type GroundedDiscoveryLatitude = "LOW" | "MEDIUM" | "HIGH";

export type GroundedDiscovery = {
  kind: GroundedDiscoveryKind;
  /** = anchorEvidence, verbatim — always literal user text (see this
   *  file's own header doc). Never includes unresolvedFocus. */
  evidence: string[];
  /** What must remain TRUE in the Reflection — not required wording.
   *  For EXPLICIT/UNRESOLVED: the literal evidence items themselves,
   *  concatenated, never reduced to a single paraphrase (this is the
   *  direct fix for explicit-meaning loss — see Sprint's own report).
   *  For RELATION/STRUCTURE: a fixed template keyed only by the
   *  already-typed RelationType enum (never free text). For CHANGE: a
   *  fixed, content-free "same continuing matter" sentence, since that
   *  is literally all this signal establishes. */
  coreClaim: string;
  provenance: GroundedDiscoveryProvenance;
  latitude: GroundedDiscoveryLatitude;
};

const RELATION_CLAIM_LABELS: Record<RelationType, (a: string, b: string) => string> = {
  limits: (a, b) => `"${a}" limits "${b}"`,
  supports: (a, b) => `"${a}" supports "${b}"`,
  conflictsWith: (a, b) => `"${a}" and "${b}" are in tension`,
  respondsTo: (a, b) => `"${b}" responds to "${a}"`,
  clarifies: (a, b) => `"${b}" clarifies "${a}"`,
  revises: (a, b) => `"${b}" revises "${a}"`,
  relatesTo: (a, b) => `"${a}" and "${b}" are connected`,
};

function buildCoreClaim(
  kind: GroundedDiscoveryKind,
  evidence: string[],
  relationType: RelationType | undefined,
): string {
  if (kind === "RELATION" || kind === "STRUCTURE") {
    const [a, b] = evidence;
    if (a && b) return RELATION_CLAIM_LABELS[relationType ?? "relatesTo"](a, b);
    return evidence.map((e) => `"${e}"`).join(" and ");
  }
  if (kind === "CHANGE") {
    const [a, b] = evidence;
    if (a && b) return `"${a}" and "${b}" are the same continuing matter, restated or elaborated across turns.`;
    return evidence.map((e) => `"${e}"`).join(" and ") || "the same matter recurred across turns.";
  }
  // EXPLICIT / UNRESOLVED — never reduced, every literal item preserved.
  return evidence.map((e) => `"${e}"`).join(" and ");
}

function computeProvenance(
  kind: GroundedDiscoveryKind,
  relationProvenance: RelationProvenance | undefined,
): GroundedDiscoveryProvenance {
  if (kind === "EXPLICIT") return "USER_EXPLICIT";
  if (kind === "RELATION" && relationProvenance === "user-stated") return "USER_EXPLICIT";
  return "STRUCTURALLY_DERIVED";
}

function computeLatitude(kind: GroundedDiscoveryKind, provenance: GroundedDiscoveryProvenance): GroundedDiscoveryLatitude {
  if (kind === "EXPLICIT" && provenance === "USER_EXPLICIT") return "HIGH";
  if (kind === "RELATION" && provenance === "USER_EXPLICIT") return "MEDIUM";
  return "LOW";
}

const DISCOVERY_TO_KIND: Record<DiscoverySignal | "explicit-only", GroundedDiscoveryKind> = {
  "explicit-only": "EXPLICIT",
  relation: "RELATION",
  change: "CHANGE",
  structure: "STRUCTURE",
  open: "UNRESOLVED",
};

function buildGroundedDiscovery(
  primaryDiscovery: DiscoverySignal | "explicit-only",
  anchorEvidence: string[],
  primaryRelationType: RelationType | undefined,
  primaryRelationProvenance: RelationProvenance | undefined,
): GroundedDiscovery {
  const kind = DISCOVERY_TO_KIND[primaryDiscovery];
  const evidence = anchorEvidence;
  const coreClaim = buildCoreClaim(kind, evidence, primaryRelationType);
  const provenance = computeProvenance(kind, primaryRelationProvenance);
  const latitude = computeLatitude(kind, provenance);
  return { kind, evidence, coreClaim, provenance, latitude };
}

/** The one place this file resolves a graph-side turn pointer back to
 *  real user words. Excludes confirmation-only and superseded evidence
 *  — never a valid anchor for new material. */
function realText(turn: number, evidence: EvidenceItem[]): string | null {
  const item = evidence.find((e) => e.turn === turn && e.status === "active" && e.act !== "confirmation");
  return item ? item.text : null;
}

function anchorsForElement(el: ContextElement, evidence: EvidenceItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ref of el.evidenceRefs) {
    const t = realText(ref.turn, evidence);
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

function liveRelations(graph: ContextGraph) {
  const activeIds = new Set(graph.elements.filter((e) => e.active).map((e) => e.id));
  return graph.relations.filter((r) => r.status !== "resolved" && activeIds.has(r.from) && activeIds.has(r.to));
}

function tryRelation(graph: ContextGraph, evidence: EvidenceItem[]): { anchor: string[]; type: RelationType; provenance: RelationProvenance } | null {
  for (const r of liveRelations(graph)) {
    const fromEl = graph.elements.find((e) => e.id === r.from);
    const toEl = graph.elements.find((e) => e.id === r.to);
    if (!fromEl || !toEl) continue;
    const fromAnchor = anchorsForElement(fromEl, evidence)[0];
    const toAnchor = anchorsForElement(toEl, evidence)[0];
    if (fromAnchor && toAnchor && fromAnchor !== toAnchor) {
      return { anchor: [fromAnchor, toAnchor], type: r.type, provenance: r.provenance };
    }
  }
  return null;
}

function tryChange(graph: ContextGraph, evidence: EvidenceItem[]): string[] | null {
  for (const el of graph.elements.filter((e) => e.active && e.evidenceRefs.length >= 2)) {
    const anchors = anchorsForElement(el, evidence);
    if (anchors.length >= 2) return anchors.slice(0, 2);
  }
  return null;
}

/** Deliberately narrower than composer.ts's own hasTension (which also
 *  accepts a bare lexical contrast marker like "하지만" between two
 *  verbatim lines, with no element/relation object behind it at all).
 *  That lexical-only case has no real element/turn to anchor precisely
 *  — exactly the "weak evidence" case correction #1 says must degrade
 *  rather than be forced into a discovery type. */
function tryStructure(graph: ContextGraph, evidence: EvidenceItem[]): { anchor: string[]; type: RelationType } | null {
  for (const r of liveRelations(graph).filter((r) => r.type === "conflictsWith" || r.type === "limits")) {
    const fromEl = graph.elements.find((e) => e.id === r.from);
    const toEl = graph.elements.find((e) => e.id === r.to);
    if (!fromEl || !toEl) continue;
    const fromAnchor = anchorsForElement(fromEl, evidence)[0];
    const toAnchor = anchorsForElement(toEl, evidence)[0];
    if (fromAnchor && toAnchor && fromAnchor !== toAnchor) return { anchor: [fromAnchor, toAnchor], type: r.type };
  }
  const conflicted = graph.elements.find((e) => e.active && e.status === "conflicted");
  if (conflicted) {
    const anchor = anchorsForElement(conflicted, evidence)[0];
    if (anchor) return { anchor: [anchor], type: "conflictsWith" };
  }
  return null;
}

function tryOpen(graph: ContextGraph, evidence: EvidenceItem[]): { anchor?: string; reason: string } | null {
  const point = graph.unresolved[0];
  if (!point || !point.reason) return null;
  const anchor = point.grounding.map((g) => realText(g.turn, evidence)).find((t): t is string => Boolean(t));
  return { anchor, reason: point.reason };
}

function fallbackAnchor(evidence: EvidenceItem[]): string[] {
  const real = evidence.filter((e) => e.status === "active" && e.act !== "confirmation");
  const last = real[real.length - 1];
  return last ? [last.text] : [];
}

/**
 * Priority order matches DiscoverySignal's own declared order in
 * finalExperienceTypes.ts (relation, change, structure, open) — no new
 * ranking invented for this Gate. Each attempt independently requires a
 * real resolved anchor (see each try* function); the first one that
 * finds one wins. Falls to "explicit-only" only when none do.
 */
export function buildReflectionPlan(
  grounding: FinalExperienceGrounding,
  evidence: EvidenceItem[] | undefined,
  graph: ContextGraph | undefined,
): ReflectionPlan {
  const ev = evidence ?? [];
  const g = graph ?? { elements: [], relations: [], unresolved: [], updateLog: [] };

  const relation = tryRelation(g, ev);
  if (relation) {
    return {
      grounding,
      anchorEvidence: relation.anchor,
      primaryDiscovery: "relation",
      primaryRelationType: relation.type,
      primaryRelationProvenance: relation.provenance,
      groundedDiscovery: buildGroundedDiscovery("relation", relation.anchor, relation.type, relation.provenance),
    };
  }
  const change = tryChange(g, ev);
  if (change) {
    return { grounding, anchorEvidence: change, primaryDiscovery: "change", groundedDiscovery: buildGroundedDiscovery("change", change, undefined, undefined) };
  }
  const structure = tryStructure(g, ev);
  if (structure) {
    return {
      grounding,
      anchorEvidence: structure.anchor,
      primaryDiscovery: "structure",
      primaryRelationType: structure.type,
      groundedDiscovery: buildGroundedDiscovery("structure", structure.anchor, structure.type, undefined),
    };
  }
  const open = tryOpen(g, ev);
  if (open) {
    const anchor = open.anchor ? [open.anchor] : [];
    return { grounding, anchorEvidence: anchor, primaryDiscovery: "open", unresolvedFocus: open.reason, groundedDiscovery: buildGroundedDiscovery("open", anchor, undefined, undefined) };
  }
  const fallback = fallbackAnchor(ev);
  return { grounding, anchorEvidence: fallback, primaryDiscovery: "explicit-only", groundedDiscovery: buildGroundedDiscovery("explicit-only", fallback, undefined, undefined) };
}
