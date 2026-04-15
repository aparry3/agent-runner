import { StreamError } from "./errors.js";
import { normalizeEvent } from "./events.js";
import { composeSignal, sendRequest } from "./fetch.js";
import { parseSSE } from "./sse.js";
import type {
  AgntzClientOptions,
  HealthResult,
  RunInput,
  RunResult,
  StreamEvent,
} from "./types.js";

export class AgntzClient {
  readonly agents: AgentsResource;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultSignal?: AbortSignal;

  constructor(opts: AgntzClientOptions) {
    if (!opts.apiKey) throw new Error("AgntzClient: apiKey is required");
    if (!opts.baseUrl) throw new Error("AgntzClient: baseUrl is required");
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl;
    this.fetchImpl = opts.fetch ?? fetch;
    this.defaultSignal = opts.defaultSignal;
    this.agents = new AgentsResource(this);
  }

  async health(): Promise<HealthResult> {
    const res = await sendRequest({
      baseUrl: this.baseUrl,
      path: "/health",
      method: "GET",
      fetchImpl: this.fetchImpl,
      signal: this.defaultSignal,
    });
    return (await res.json()) as HealthResult;
  }

  /** @internal */
  _runRequest(input: RunInput, stream: boolean): Promise<Response> {
    const signal = composeSignal(this.defaultSignal, input.signal);
    const body: Record<string, unknown> = { agentId: input.agentId };
    if (input.input !== undefined) body.input = input.input;
    if (input.sessionId !== undefined) body.sessionId = input.sessionId;
    return sendRequest({
      baseUrl: this.baseUrl,
      path: stream ? "/run/stream" : "/run",
      method: "POST",
      apiKey: this.apiKey,
      body,
      signal,
      accept: stream ? "text/event-stream" : undefined,
      fetchImpl: this.fetchImpl,
    });
  }

  /** @internal */
  _resolveStreamSignal(input: RunInput): AbortSignal | undefined {
    return composeSignal(this.defaultSignal, input.signal);
  }
}

export class AgentsResource {
  constructor(private readonly client: AgntzClient) {}

  async run(input: RunInput): Promise<RunResult> {
    const res = await this.client._runRequest(input, false);
    return (await res.json()) as RunResult;
  }

  stream(input: RunInput): AsyncGenerator<StreamEvent, void, void> {
    return streamAgentEvents(this.client, input);
  }
}

async function* streamAgentEvents(
  client: AgntzClient,
  input: RunInput,
): AsyncGenerator<StreamEvent, void, void> {
  const res = await client._runRequest(input, true);
  if (!res.body) {
    throw new StreamError("Worker returned no stream body", { status: res.status });
  }
  const signal = client._resolveStreamSignal(input);
  let sawTerminal = false;
  let aborted = false;
  const onAbort = () => {
    aborted = true;
  };
  if (signal) {
    if (signal.aborted) aborted = true;
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    for await (const frame of parseSSE(res.body, signal)) {
      const event = normalizeEvent(frame);
      if (!event) continue;
      if (event.type === "complete" || event.type === "error") {
        sawTerminal = true;
      }
      yield event;
      if (sawTerminal) return;
    }
    if (!sawTerminal && !aborted) {
      throw new StreamError("Stream closed before completion", {
        code: "STREAM_TRUNCATED",
      });
    }
  } finally {
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}
