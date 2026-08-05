import type { EngineRequest, EngineOutput } from "./hriRuntime";

function apiEndpoint(): string {
  const remoteBase = process.env.NEXT_PUBLIC_HRI_API_BASE?.replace(/\/$/, "");
 return "/api/analyze";
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

export type ObservationLogInput = {
  sessionId: string;
  firstInput: string;
  turnCount: number;
  reflectionCompleted: boolean;
  feedback?: string | null;
};

// Fire-and-forget by design — mirrors the server-side contract (adapter.ts,
// neonStorage.ts) where a logging failure must never interrupt the HRI
// conversation. No await, no thrown error, no retry.
export function logObservationEvent(event: ObservationLogInput): void {
  fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  }).catch(() => {});
}
