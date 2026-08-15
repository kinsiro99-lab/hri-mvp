/**
 * Fixed Evaluation Set — Sprint12-D §16.
 *
 * The 10 hard problems from Sprint12-C plus the two real web-reported
 * failure conversations. These are locked: do not delete, soften, or
 * add new regex/keywords anywhere else in this directory to make a
 * particular adapter pass them (Sprint12-D §15/§23).
 *
 * Sprint12-D §18: invariants are STRUCTURAL, never a golden-text
 * comparison. Each invariant is a pure predicate over the final
 * ContextGraph after all turns are processed — it checks relations,
 * element counts, and confidence tiers, never exact wording.
 */
import type { ContextGraph } from "./types";
import { CONTEXT_CONFIDENCE_POLICY } from "./confidencePolicy";

export type Invariant = {
  name: string;
  check: (graph: ContextGraph) => boolean;
};

export type EvaluationCase = {
  id: string;
  turns: string[];
  invariants: Invariant[];
};

function activeElements(graph: ContextGraph, kind?: string) {
  return graph.elements.filter((e) => e.active && (!kind || e.kind === kind));
}
function containsAny(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n));
}
function hasRelationBetween(graph: ContextGraph, types: string[], predA: (d: string) => boolean, predB: (d: string) => boolean): boolean {
  return graph.relations.some((r) => {
    if (!types.includes(r.type)) return false;
    const from = graph.elements.find((e) => e.id === r.from);
    const to = graph.elements.find((e) => e.id === r.to);
    if (!from || !to) return false;
    return (predA(from.description) && predB(to.description)) || (predA(to.description) && predB(from.description));
  });
}

export const EVALUATION_CASES: EvaluationCase[] = [
  {
    id: "1-paraphrase",
    turns: ["회사를 옮기고 싶다", "조금 다른 환경에서 새로 시작하는 것도 생각 중이다"],
    invariants: [
      {
        name: "paraphrase linked (merged into one active direction, or explicitly related)",
        check: (g) => {
          const directions = activeElements(g, "direction");
          if (directions.length === 1) return true;
          return g.relations.some((r) => ["relatesTo", "supports", "clarifies"].includes(r.type));
        },
      },
    ],
  },
  {
    id: "2-reference-resolution",
    turns: ["친구에게 연락했지만 답이 없다", "연락이 오면 그 일을 확인할 수 있다"],
    invariants: [
      {
        name: "ambiguous '그 일' not confidently assigned as a new grounded fact",
        check: (g) => {
          const suspect = g.elements.find((e) => e.description.includes("그 일"));
          if (!suspect) return true;
          return suspect.confidence < CONTEXT_CONFIDENCE_POLICY.GROUNDED_MIN || g.unresolved.some((u) => u.relatesTo.includes(suspect.id));
        },
      },
    ],
  },
  {
    id: "3-separate-situations",
    turns: ["친구 답장을 기다리고 있다", "업무상 확인해야 할 일도 있다"],
    invariants: [
      {
        name: "two distinct active situations, not merged into one",
        check: (g) => activeElements(g, "situation").length >= 2,
      },
    ],
  },
  {
    id: "4-double-negation",
    turns: ["걱정이 없는 건 아니지만 크게 불안하지는 않다"],
    invariants: [
      {
        name: "nuance preserved (both 걱정 and 불안 present, not collapsed to a bare strong-anxiety label)",
        check: (g) => g.elements.some((e) => containsAny(e.description, ["걱정"]) && containsAny(e.description, ["불안"])),
      },
    ],
  },
  {
    id: "5-revision",
    turns: ["출장을 빨리 가야 한다", "생각해보니 다음 주로 미뤄도 된다"],
    invariants: [
      {
        name: "original urgency element revised, not silently unchanged nor deleted",
        check: (g) => g.elements.some((e) => containsAny(e.description, ["출장"]) && (e.status === "revised" || e.status === "deprioritized")),
      },
    ],
  },
  {
    id: "6-multiple-directions",
    turns: ["지금 일을 계속하는 것도 괜찮다", "새로운 일을 시작해보고 싶기도 하다"],
    invariants: [
      {
        name: "two active directions kept, related rather than one overwriting the other",
        check: (g) => {
          const directions = activeElements(g, "direction");
          return directions.length >= 2 && g.relations.some((r) => ["conflictsWith", "relatesTo"].includes(r.type));
        },
      },
    ],
  },
  {
    id: "7-no-fake-tension",
    turns: ["오늘 너무 피곤하다", "잠을 제대로 못 잤다", "조금 쉬고 싶다"],
    invariants: [
      {
        name: "zero conflictsWith/limits relations when nothing actually conflicts",
        check: (g) => !g.relations.some((r) => r.type === "conflictsWith" || r.type === "limits"),
      },
    ],
  },
  {
    id: "8-topic-shift",
    turns: ["친구 답장이 없어 걱정된다", "그런데 사실 오늘 더 신경 쓰이는 건 회사 일이다"],
    invariants: [
      {
        name: "original friend-related element preserved (not deleted) after topic shift",
        check: (g) => g.elements.some((e) => containsAny(e.description, ["친구", "답장"])),
      },
      {
        name: "new work-related element created as separate",
        check: (g) => g.elements.some((e) => containsAny(e.description, ["회사", "업무"])),
      },
    ],
  },
  {
    id: "9-correction",
    turns: ["친구와 싸웠다", "아니다, 싸운 건 아니고 그냥 연락이 뜸해졌다"],
    invariants: [
      {
        name: "'싸웠다' element revised/deprioritized, not left as unchanged active fact",
        check: (g) => g.elements.some((e) => e.description.includes("싸웠다") && e.status !== "active"),
      },
    ],
  },
  {
    id: "10-ambiguity",
    turns: ["그게 좀 걸린다"],
    invariants: [
      {
        name: "bare demonstrative not asserted at grounded-tier confidence",
        check: (g) => !g.elements.some((e) => e.confidence >= CONTEXT_CONFIDENCE_POLICY.GROUNDED_MIN && e.description.trim().startsWith("그게")),
      },
    ],
  },
  {
    id: "web-case-a",
    turns: [
      "지루한 여름이였다",
      "출장을 가는 일을 우선해야한다",
      "일들이 밀려있어 쉽게 떠나기 어렵다",
      "서둘러 일들을 마무리 짓고 싶다",
    ],
    invariants: [
      { name: "출장 우선 Direction 존재", check: (g) => activeElements(g, "direction").some((e) => e.description.includes("출장")) },
      { name: "밀린 일 Constraint 존재", check: (g) => activeElements(g, "constraint").some((e) => containsAny(e.description, ["밀려", "일들"])) },
      {
        name: "출장 Direction과 밀린 일 Constraint 사이 limits/conflictsWith relation 존재",
        check: (g) => hasRelationBetween(g, ["limits", "conflictsWith"], (d) => d.includes("출장"), (d) => containsAny(d, ["밀려", "어렵"])),
      },
      { name: "'서둘러 마무리' 발화가 그래프에서 소실되지 않음", check: (g) => g.elements.some((e) => containsAny(e.description, ["서둘러", "마무리"])) },
    ],
  },
  {
    id: "web-case-b",
    turns: [
      "친구에게 연락을 했지만 답이없다",
      "무슨 일이 있는지 걱정이 된다",
      "연락을 기다리는 마음이 답답할 뿐이다",
      "업무상으로도 확인해야할 일들이 기다리고 있다",
      "당연히 연락이 오기를 기다리는 것이다",
    ],
    invariants: [
      { name: "친구 연락 Situation 존재", check: (g) => g.elements.some((e) => containsAny(e.description, ["친구"])) },
      { name: "업무 Situation 별개로 존재", check: (g) => g.elements.some((e) => containsAny(e.description, ["업무"])) },
      {
        name: "친구/업무 두 Situation이 병합되지 않고 유지됨",
        check: (g) => {
          const friend = g.elements.filter((e) => containsAny(e.description, ["친구"]));
          const work = g.elements.filter((e) => containsAny(e.description, ["업무"]));
          return friend.length > 0 && work.length > 0 && friend.every((f) => !work.some((w) => w.id === f.id));
        },
      },
      {
        name: "마지막 턴('연락이 오기를 기다린다')이 업무 Situation에 고신뢰로 확정 병합되지 않음(ambiguous면 허용)",
        check: (g) => {
          const last = g.elements.find((e) => e.description.includes("당연히"));
          if (!last) return true; // 별도 요소로 안 남았다면 이 불변식은 해당 없음
          const mergedIntoWork = g.elements.some(
            (e) => containsAny(e.description, ["업무"]) && e.description.includes("당연히") && e.confidence >= CONTEXT_CONFIDENCE_POLICY.GROUNDED_MIN,
          );
          return !mergedIntoWork;
        },
      },
    ],
  },
];
