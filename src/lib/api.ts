import type { EngineRequest, EngineOutput } from "./questionEngine";

function apiEndpoint(): string {
  const remoteBase = process.env.NEXT_PUBLIC_HRI_API_BASE?.replace(/\/$/, "");
  return remoteBase ? `${remoteBase}/api/analyze` : "/api/analyze";
}

export async function callEngine(request: EngineRequest): Promise<EngineOutput> {
  const response = await fetch(apiEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`HRI engine request failed: ${response.status}`);
  }

  return (await response.json()) as EngineOutput;
}
