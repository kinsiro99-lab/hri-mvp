import { getNextOutput, type EngineRequest } from "@/lib/hriRuntime";
import { advanceSession } from "@/lib/hri/controller";
import { devLog } from "@/lib/devLog";
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as EngineRequest;
    devLog("ROUTE OK");
    const result = getNextOutput(payload);

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
