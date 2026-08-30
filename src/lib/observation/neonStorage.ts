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
import type { ObservationEvent, ObservationReflection, ObservationTurn } from "./types";
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
}
