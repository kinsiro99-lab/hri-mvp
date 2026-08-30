/**
 * Neon Postgres adapter for Observation Console logging. Optional —
 * only active when DATABASE_URL is set (see .env.example). Any
 * failure (missing config, network, query error) resolves to
 * persisted:false rather than throwing, so a database outage can
 * never interrupt the HRI conversation that triggered the log call.
 *
 * Schema: src/lib/observation/schema.sql (run manually against Neon;
 * this adapter never issues DDL).
 */

import { neon } from "@neondatabase/serverless";
import type { ObservationEvent, ObservationReflection, ObservationRealityGain, ObservationQuestionQuality, ObservationReflectionSafety, ObservationTurn } from "./types";
import type { ObservationStorage, ObservationStorageResult } from "./storage";

export class NeonObservationStorage implements ObservationStorage {
  async record(event: ObservationEvent): Promise<ObservationStorageResult> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return {
        persisted: false,
        reason: "DATABASE_URL is not configured — Neon storage is inactive.",
      };
    }

    try {
      const sql = neon(connectionString);
      await sql`
        INSERT INTO observation_events
          (timestamp, session_id, first_input, turn_count, reflection_completed, feedback)
        VALUES
          (${event.timestamp}, ${event.sessionId}, ${event.firstInput}, ${event.turnCount}, ${event.reflectionCompleted}, ${event.feedback})
      `;
      return { persisted: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Neon storage error";
      return { persisted: false, reason: message };
    }
  }

  // Question Observation Foundation Sprint 01 — same
  // never-throws/DATABASE_URL-optional contract as record() above,
  // targeting the new additive observation_turns table (schema.sql).
  // UNIQUE(session_id, turn_index) on that table means a duplicate
  // write (e.g. a client retry) fails this INSERT rather than creating
  // a second row — caught below, reported as persisted:false, never
  // thrown back to the caller.
  async recordTurn(turn: ObservationTurn): Promise<ObservationStorageResult> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return {
        persisted: false,
        reason: "DATABASE_URL is not configured — Neon storage is inactive.",
      };
    }

    try {
      const sql = neon(connectionString);
      await sql`
        INSERT INTO observation_turns
          (timestamp, session_id, turn_index, question_text, question_ref, answer_text)
        VALUES
          (${turn.timestamp}, ${turn.sessionId}, ${turn.turnIndex}, ${turn.questionText}, ${turn.questionRef}, ${turn.answerText})
      `;
      return { persisted: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Neon storage error";
      return { persisted: false, reason: message };
    }
  }

  // Question Observation Foundation Sprint 01 — targets the new
  // additive observation_reflections table (schema.sql). Deliberately
  // a separate table/INSERT from observation_events, not an UPDATE to
  // the existing session-level row — that row has no unique key to
  // safely target, and this sprint must not touch its write path.
  async recordReflection(reflection: ObservationReflection): Promise<ObservationStorageResult> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return {
        persisted: false,
        reason: "DATABASE_URL is not configured — Neon storage is inactive.",
      };
    }

    try {
      const sql = neon(connectionString);
      await sql`
        INSERT INTO observation_reflections
          (timestamp, session_id, reflection_text)
        VALUES
          (${reflection.timestamp}, ${reflection.sessionId}, ${reflection.reflectionText})
      `;
      return { persisted: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Neon storage error";
      return { persisted: false, reason: message };
    }
  }

  // Reality Gain Observation Sprint 02 — targets the new additive
  // observation_reality_gains table (schema.sql). Same
  // UNIQUE(session_id, turn_index) duplicate-write protection as
  // recordTurn above; independent table, does not touch
  // observation_turns/observation_reflections at all.
  async recordRealityGain(gain: ObservationRealityGain): Promise<ObservationStorageResult> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return {
        persisted: false,
        reason: "DATABASE_URL is not configured — Neon storage is inactive.",
      };
    }

    try {
      const sql = neon(connectionString);
      await sql`
        INSERT INTO observation_reality_gains
          (timestamp, session_id, turn_index, gain_type, new_element_count, updated_element_count, new_relation_count, element_ref)
        VALUES
          (${gain.timestamp}, ${gain.sessionId}, ${gain.turnIndex}, ${gain.gainType}, ${gain.newElementCount}, ${gain.updatedElementCount}, ${gain.newRelationCount}, ${gain.elementRef})
      `;
      return { persisted: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Neon storage error";
      return { persisted: false, reason: message };
    }
  }

  // Question Quality Evaluation V1 Sprint 03 — targets the new
  // additive observation_question_quality table (schema.sql). Same
  // UNIQUE(session_id, turn_index) duplicate-write protection; a
  // judgment table separate from observation_reality_gains, never an
  // UPDATE to it.
  async recordQuestionQuality(quality: ObservationQuestionQuality): Promise<ObservationStorageResult> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return {
        persisted: false,
        reason: "DATABASE_URL is not configured — Neon storage is inactive.",
      };
    }

    try {
      const sql = neon(connectionString);
      await sql`
        INSERT INTO observation_question_quality
          (timestamp, session_id, turn_index, evaluation_version, reality_gain, redundancy, grounding_safety, information_gain, provenance)
        VALUES
          (${quality.timestamp}, ${quality.sessionId}, ${quality.turnIndex}, ${quality.evaluationVersion}, ${quality.realityGain}, ${quality.redundancy}, ${quality.groundingSafety}, ${quality.informationGain}, ${quality.provenance})
      `;
      return { persisted: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Neon storage error";
      return { persisted: false, reason: message };
    }
  }

  // Reflection Safety Observation V1 Sprint 04 — targets the new
  // additive observation_reflection_safety table (schema.sql).
  // Session-level linkage only (no turn_index) — see
  // ObservationReflectionSafety's own doc in types.ts for why. No
  // UNIQUE constraint: unlike observation_turns/reality_gains/
  // question_quality (one row per turn, naturally unique), a session
  // could in principle produce more than one Final Experience call
  // (e.g. a retry path outside this Sprint's scope) — never force-
  // deduplicated here, matching observation_reflections' own shape.
  async recordReflectionSafety(safety: ObservationReflectionSafety): Promise<ObservationStorageResult> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return {
        persisted: false,
        reason: "DATABASE_URL is not configured — Neon storage is inactive.",
      };
    }

    try {
      const sql = neon(connectionString);
      await sql`
        INSERT INTO observation_reflection_safety
          (timestamp, session_id, evaluation_version, reflection_outcome, error_message, provenance)
        VALUES
          (${safety.timestamp}, ${safety.sessionId}, ${safety.evaluationVersion}, ${safety.reflectionOutcome}, ${safety.errorMessage}, ${safety.provenance})
      `;
      return { persisted: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Neon storage error";
      return { persisted: false, reason: message };
    }
  }
}
