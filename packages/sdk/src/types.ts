export interface AgntzClientOptions {
  apiKey: string;
  baseUrl: string;
  fetch?: typeof fetch;
  defaultSignal?: AbortSignal;
}

export interface RunInput {
  agentId: string;
  input?: unknown;
  /** Forward-compat: worker accepts but ignores today. */
  sessionId?: string;
  signal?: AbortSignal;
}

export interface RunResult {
  output: unknown;
  state: Record<string, unknown>;
}

export type AgentKind = "llm" | "tool" | "sequential" | "parallel";

export type StreamEvent =
  | { type: "start"; agentId: string; kind: AgentKind }
  | { type: "complete"; output: unknown; state: Record<string, unknown> }
  | { type: "error"; error: string };

export interface HealthResult {
  status: string;
  service: string;
}

/** @internal */
export interface SseFrame {
  event?: string;
  data: string;
  id?: string;
}
