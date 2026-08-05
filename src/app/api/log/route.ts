import { NoopObservationStorage } from "@/lib/observation/storage";
import { NeonObservationStorage } from "@/lib/observation/neonStorage";
import type { ObservationStorage } from "@/lib/observation/storage";
import { emitObservationEvent, INVALID_OBSERVATION_EVENT_REASON } from "@/lib/observation/adapter";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function selectStorage(): ObservationStorage {
  return process.env.DATABASE_URL
    ? new NeonObservationStorage()
    : new NoopObservationStorage();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await emitObservationEvent(body, selectStorage());

    if (result.reason === INVALID_OBSERVATION_EVENT_REASON) {
      return new Response(JSON.stringify({ ok: false, ...result }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    return new Response(JSON.stringify({ ok: result.persisted, ...result }), {
      status: result.persisted ? 200 : 501,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown log route error";

    return new Response(JSON.stringify({ ok: false, persisted: false, error: message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
}
