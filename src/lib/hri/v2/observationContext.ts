/**
 * Observation Context Layer.
 *
 * A standalone, dependency-free module. It imports nothing from the
 * engine. `detectObservationContext` is a pure function: same input
 * always produces the same output, no side effects, no shared state.
 *
 * WIRED (First Runtime Integration): controller.ts now calls
 * detectObservationContext() as an auxiliary, Beta-gated signal — see
 * that file's Observation OS overlay block. This module's own logic
 * is unchanged; it still does not import anything from the engine.
 */

/** The domain a user's input appears to be about. */
export type ObservationContext =
  | "individual"
  | "organization"
  | "relationship"
  | "project"
  | "uncertain";

export type ObservationContextResult = {
  context: ObservationContext;
  /** 0–1. How much the winning context stood out from the runner-up,
   *  not just how many keywords matched — one match isn't the same as
   *  a dominant signal. */
  confidence: number;
  /** The exact keywords/phrases found in the input that justify the
   *  classification — always traceable back to the real text, never
   *  fabricated. Empty when context is "uncertain". */
  evidence: string[];
};

type ScoredContext = Exclude<ObservationContext, "uncertain">;

// Keyword signals per context. Intentionally simple for Step 1 — a
// starting classifier to refine once real usage data exists, not a
// finished model.
const CONTEXT_SIGNALS: Record<ScoredContext, string[]> = {
  individual: ["나는", "내가", "나의", "저는", "제가", "제 마음", "제 생각", "혼자"],
  organization: ["회사", "조직", "팀", "부서", "직장", "상사", "동료", "회의", "업무 지시"],
  relationship: ["관계", "친구", "가족", "연인", "남편", "아내", "부모", "자녀", "사람들과"],
  project: ["프로젝트", "일정", "마감", "작업", "계획", "목표", "진행 상황"],
};

const MIN_CONFIDENCE = 0.3;

/**
 * Classifies raw input text into one of the five observation contexts.
 * Pure function — no engine calls, no mutation, no randomness.
 */
export function detectObservationContext(input: string): ObservationContextResult {
  const text = input.trim();

  if (!text) {
    return { context: "uncertain", confidence: 0, evidence: [] };
  }

  const matches: Record<ScoredContext, string[]> = {
    individual: [],
    organization: [],
    relationship: [],
    project: [],
  };

  for (const context of Object.keys(CONTEXT_SIGNALS) as ScoredContext[]) {
    for (const keyword of CONTEXT_SIGNALS[context]) {
      if (text.includes(keyword)) {
        matches[context].push(keyword);
      }
    }
  }

  const ranked = (Object.entries(matches) as [ScoredContext, string[]][]).sort(
    (a, b) => b[1].length - a[1].length,
  );

  const [topContext, topEvidence] = ranked[0];
  const runnerUpCount = ranked[1]?.[1].length ?? 0;

  if (topEvidence.length === 0) {
    return { context: "uncertain", confidence: 0, evidence: [] };
  }

  const totalMatches = topEvidence.length + runnerUpCount;
  const dominance = totalMatches > 0 ? topEvidence.length / totalMatches : 1;
  const strength = Math.min(1, topEvidence.length / 3);
  const confidence = Math.min(1, dominance * strength);

  if (confidence < MIN_CONFIDENCE) {
    return { context: "uncertain", confidence, evidence: topEvidence };
  }

  return { context: topContext, confidence, evidence: topEvidence };
}
