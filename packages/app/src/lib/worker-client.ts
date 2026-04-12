const WORKER_URL = process.env.WORKER_URL ?? "http://localhost:4001";

export interface RunRequest {
  agentId: string;
  input: unknown;
  sessionId?: string;
}

export interface RunResult {
  output: unknown;
  state: Record<string, unknown>;
}

/**
 * Call the worker's /run endpoint (request-response).
 */
export async function workerRun(req: RunRequest): Promise<RunResult> {
  const res = await fetch(`${WORKER_URL}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Worker error: ${res.status}`);
  }

  return res.json() as Promise<RunResult>;
}

/**
 * Call the worker's /run/stream endpoint. Returns a ReadableStream of SSE events.
 */
export async function workerRunStream(req: RunRequest): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${WORKER_URL}/run/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Worker error: ${res.status}`);
  }

  if (!res.body) {
    throw new Error("Worker returned no stream body");
  }

  return res.body;
}
