/**
 * Rule-Based Adapter — Sprint12-D §15.
 *
 * Wraps Sprint12-B's src/lib/hri/v2/contextShadow.ts behind the
 * SemanticContextInterpreter interface, UNMODIFIED — no new regex,
 * keyword, or heuristic is added here or there. This file only
 * translates contextShadow.ts's own ShadowContext/updateLog shape
 * into the Contract's InterpreterOutput shape.
 *
 * Purpose: NOT to make the rule engine good. It is the deterministic,
 * zero-dependency fallback/baseline that every future Semantic
 * Provider gets compared against on the exact same
 * evaluationHarness.ts — including its known failures (paraphrase
 * linking, borderline token-overlap misses; see Sprint12-C §K). Those
 * failures are left in place on purpose, as the baseline a real
 * provider must beat.
 *
 * Confidence: contextShadow.ts's ShadowElement/Tension carry no
 * confidence field at all (a gap Sprint12-C §K.10 already flagged).
 * This adapter assigns a flat, undtuned confidence to every proposal
 * — see FLAT_CONFIDENCE below — rather than inventing a scoring
 * function, so the baseline's numbers are honestly "the rule engine
 * doesn't know how confident it is," not an inflated number designed
 * to look competitive.
 */
import {
  emptyShadowContext,
  updateShadowContext,
  type ShadowContext,
  type ShadowElement,
} from "../v2/contextShadow";
import type {
  InterpreterInput,
  InterpreterOutput,
  ProposedElement,
  ProposedRelation,
  ProposedUnresolved,
  ProposedUpdate,
  SemanticContextInterpreter,
} from "./types";

/** Deliberately flat and below CONTEXT_CONFIDENCE_POLICY.GROUNDED_MIN
 *  — the rule engine's pattern match succeeding says nothing reliable
 *  about whether the resulting description is actually correct. */
const FLAT_CONFIDENCE = 0.6;

function allElements(ctx: ShadowContext): ShadowElement[] {
  return [...ctx.situations, ...ctx.directions, ...ctx.constraints, ...ctx.responses];
}

function findElement(ctx: ShadowContext, id: string): ShadowElement | undefined {
  return allElements(ctx).find((e) => e.id === id);
}

export function createRuleBasedAdapter(): SemanticContextInterpreter {
  let shadow: ShadowContext | undefined = undefined;

  return {
    async interpret(input: InterpreterInput): Promise<InterpreterOutput> {
      const last = input.recentTurns[input.recentTurns.length - 1];
      if (!last) {
        return { newElements: [], updatedElements: [], relations: [], unresolvedCandidates: [], confidence: FLAT_CONFIDENCE, uncertaintyNotes: ["no turn provided"] };
      }

      const prev = shadow ?? emptyShadowContext();
      const next = updateShadowContext(prev, last.text, last.turn);
      shadow = next;

      const thisTurnLog = next.updateLog.filter((l) => l.turn === last.turn);

      const newElements: ProposedElement[] = [];
      const updatedElements: ProposedUpdate[] = [];
      const relations: ProposedRelation[] = [];

      for (const entry of thisTurnLog) {
        // Tension log entries use either "tension-N" (reinforce on an
        // existing open tension) or "elemA~elemB" (tension just
        // created) as elementId — neither matches a real
        // situation/direction/constraint/response id.
        const tensionById = next.tensions.find((t) => t.id === entry.elementId);
        const tensionByPair = entry.elementId.includes("~")
          ? next.tensions.find((t) => entry.elementId === `${t.a}~${t.b}`)
          : undefined;
        const tension = tensionById ?? tensionByPair;

        if (tension) {
          if (entry.kind === "create") {
            relations.push({
              type: "conflictsWith",
              from: tension.a,
              to: tension.b,
              groundingTurn: last.turn,
              groundingText: last.text,
              confidence: FLAT_CONFIDENCE,
            });
          }
          // reinforce-on-tension: no separate proposal type exists for
          // "add evidence to a relation" in this Sprint's Contract —
          // left as an uncaptured baseline gap, noted in the Gate
          // report rather than papered over with a new field.
          continue;
        }

        const el = findElement(next, entry.elementId);
        if (!el) continue;

        if (entry.kind === "create") {
          newElements.push({
            localRef: el.id,
            kind: el.kind,
            description: el.description,
            groundingTurn: last.turn,
            groundingText: last.text,
            confidence: FLAT_CONFIDENCE,
          });
        } else {
          updatedElements.push({
            targetElementId: el.id,
            kind: entry.kind as ProposedUpdate["kind"],
            // Sprint12-E2 §13 originally set this to "uncertainSameElement"
            // as an honesty default. Sprint12-E3 §7 changed the merge policy
            // so "uncertainSameElement" updates are withheld from the graph
            // entirely (identity uncertainty, not just evidence-quality
            // uncertainty) — which would silently break every Rule baseline
            // case that depends on revise/reinforce/deprioritize/resolve
            // actually landing (5-revision, 8-topic-shift, 9-correction).
            // "continuation" is the more accurate label anyway: el.id above
            // came from contextShadow.ts's own deterministic pattern match
            // against `next`, not a guess — the identity question (WHICH
            // element) is answered by rule matching, only the evidence
            // quality is unrated (that's what FLAT_CONFIDENCE already
            // reports honestly).
            identityRelation: "continuation",
            // Sprint12-E5 §6: contextShadow.ts has no second opinion about
            // "what kind would this be if it weren't a continuation" — its
            // pattern match already decided this IS the target (`el`)
            // deterministically, so the most honest value is the target's
            // own kind, not a guess at some other role.
            impliedElementKind: el.kind,
            note: entry.note,
            groundingTurn: last.turn,
            groundingText: last.text,
            confidence: FLAT_CONFIDENCE,
          });
        }
      }

      // contextShadow.ts recomputes unresolvedPoints fresh every call
      // (not a delta) — mapped in full each time. worthiness->
      // potentialInformationGain and the uncertainty value are a
      // translation, not something contextShadow.ts itself computes;
      // groundingTurn/groundingText use this call's turn as a proxy
      // since a Tension's real grounding spans multiple turns and the
      // Contract's ProposedUnresolved only has room for one.
      //
      // Sprint12-E8 §13/§14: contextShadow.ts's own recompute is a
      // full-state snapshot every call, unlike the Semantic Provider's
      // narrow-window incremental proposals — under Sprint12-E8's new
      // carry-forward merge policy (evaluationHarness.ts's
      // mergeUnresolved), re-emitting the SAME open tension every turn
      // with no id would duplicate it once per turn it stays open.
      // `u.id` is already a stable id contextShadow.ts assigns to each
      // tension-derived UnresolvedPoint (unchanged, still
      // `unresolved-${t.id}` — see contextShadow.ts's own
      // recomputeUnresolved) — echoing it as `existingUnresolvedId`
      // lets the harness update the SAME persisted point in place
      // instead of duplicating it, using only an id that already
      // existed, not a new matching heuristic.
      const unresolvedCandidates: ProposedUnresolved[] = next.unresolvedPoints.map((u) => ({
        existingUnresolvedId: u.id,
        relatesTo: u.relatesTo,
        reason: u.reason,
        groundingTurn: last.turn,
        groundingText: last.text,
        uncertainty: u.worthiness === "primary" ? 0.3 : u.worthiness === "secondary" ? 0.5 : 0.8,
        potentialInformationGain: u.worthiness === "primary" ? "high" : u.worthiness === "secondary" ? "medium" : "low",
      }));

      return {
        newElements,
        updatedElements,
        relations,
        unresolvedCandidates,
        confidence: FLAT_CONFIDENCE,
        uncertaintyNotes: ["Rule Shadow baseline (Sprint12-B contextShadow.ts) — flat, untuned confidence; no real semantic signal"],
      };
    },
  };
}
