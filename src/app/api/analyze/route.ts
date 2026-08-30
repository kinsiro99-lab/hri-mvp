import { getNextOutput, type EngineRequest } from "@/lib/hriRuntime";
import { advanceSession } from "@/lib/hri/controller";
import { devLog } from "@/lib/devLog";
import { NeonObservationStorage } from "@/lib/observation/neonStorage";
import { NoopObservationStorage } from "@/lib/observation/storage";
import { emitObservationReflection, emitObservationTurn } from "@/lib/observation/adapter";
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

// Question Observation Foundation Sprint 01 — server-side, awaited
// (reliable) writes for the two new Observation record types, run
// after the real engine result already exists and always inside their
// own try/catch: a failure here is logged (devLog) and swallowed,
// never turned into a 500 or allowed to delay/replace the response
// the user is waiting on. This does not touch the existing
// client-triggered /api/log path (observation_events) at all — that
// stays exactly as it was.
async function recordTurnObservation(payload: EngineRequest, result: Awaited<ReturnType<typeof getNextOutput>>) {
  if (!payload.sessionId || !payload.previousQuestion) return;
  const inputs = Array.isArray(payload.inputs) ? payload.inputs : [];
  const answerText = inputs[inputs.length - 1];
  if (typeof answerText !== "string" || !answerText.trim()) return;

  const storage = process.env.DATABASE_URL ? new NeonObservationStorage() : new NoopObservationStorage();
  const outcome = await emitObservationTurn(
    {
      sessionId: payload.sessionId,
      turnIndex: payload.turn,
      questionText: payload.previousQuestion,
      questionRef: null,
      answerText,
    },
    storage,
  );
  if (!outcome.persisted) devLog("Observation turn not persisted:", outcome.reason);
}

async function recordReflectionObservation(payload: EngineRequest, result: Awaited<ReturnType<typeof getNextOutput>>) {
  if (!payload.sessionId || !result.reflection) return;

  const storage = process.env.DATABASE_URL ? new NeonObservationStorage() : new NoopObservationStorage();
  const outcome = await emitObservationReflection(
    { sessionId: payload.sessionId, reflectionText: result.reflection },
    storage,
  );
  if (!outcome.persisted) devLog("Observation reflection not persisted:", outcome.reason);
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as EngineRequest;
    devLog("ROUTE OK");
    const result = await getNextOutput(payload);

    try {
      await recordTurnObservation(payload, result);
      await recordReflectionObservation(payload, result);
    } catch (observationError) {
      // Belt-and-suspenders — emitObservationTurn/Reflection already
      // never throw, but this call site must never let an Observation
      // problem affect the response the user is actually waiting on.
      devLog("Observation logging error (ignored):", observationError);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analyze route error";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
}
