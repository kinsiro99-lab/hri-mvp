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
import type { ObservationEvent } from "./types";
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
}
