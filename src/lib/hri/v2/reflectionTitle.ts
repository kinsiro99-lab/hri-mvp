/**
 * Reflection Title Resolver — Step 6 Runtime Integration.
 *
 * The one canonical place Reflection title text is decided. Replaces
 * the five hardcoded title literals that used to live inside
 * reflectionComposer.ts's individual composer functions, and the
 * root problem behind them: state.topic (a locked, keyword-only
 * classifier from understandingEngine.ts) was the sole input, so the
 * broad "업무 압박" bucket produced the same "현재의 업무 흐름" title
 * for both individual and organization sessions regardless of which
 * one the input actually described.
 *
 * Pure and deterministic: same (state, hint) always produces the same
 * title, no side effects, no reads beyond its two parameters. Never
 * generates prose from raw user text — every returned string is one of
 * a small fixed set of literals chosen by context/topic, never
 * interpolated. currentNode and goal are deliberately unused here —
 * observation context and state.topic are already enough to satisfy
 * the Beta policy below; reading finer-grained fields would be
 * precision the current policy doesn't call for.
 */

import type { UnderstandingState } from "./understandingEngine";
import type { ReflectionHint } from "./reflectionHint";

/**
 * Observation context is authoritative when available (hint is always
 * present with a real ObservationContext once Step 5's overlay runs —
 * even its no-op/fallback shape sets context:"uncertain" rather than
 * omitting it). Only when there is no hint at all does context default
 * to "uncertain" here.
 */
export function resolveReflectionTitle(
  state: UnderstandingState,
  hint?: ReflectionHint,
): string {
  const context = hint?.context ?? "uncertain";

  switch (context) {
    case "organization":
      return "현재의 조직 흐름";

    case "project":
      return "현재의 프로젝트 흐름";

    case "relationship":
      return "현재 마음의 흐름";

    case "individual":
      if (state.topic === "몸 상태") return "현재의 몸 상태";
      if (state.topic === "기억") return "현재의 기억 흐름";
      return "지금의 내면 흐름";

    case "uncertain":
    default:
      if (state.topic === "관계") return "현재 마음의 흐름";
      if (state.topic === "몸 상태") return "현재의 몸 상태";
      if (state.topic === "기억") return "현재의 기억 흐름";
      return "지금의 흐름";
  }
}
