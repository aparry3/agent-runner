import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import type { Runner } from "@agent-runner/core";
import { execute, parseManifest } from "@agent-runner/manifest";
import type { AgentManifest } from "@agent-runner/manifest";
import { createExecutionContext } from "./bridge.js";

export interface WorkerAPIOptions {
  runner: Runner;
}

/**
 * Create the worker API routes.
 */
export function createWorkerAPI({ runner }: WorkerAPIOptions): Hono {
  const app = new Hono();
  const ctx = createExecutionContext(runner);

  app.use("*", cors());

  // ─── Health ───────────────────────────────────────────────────────

  app.get("/health", (c) => {
    return c.json({ status: "ok", service: "agent-runner-worker" });
  });

  // ─── Run (request-response) ───────────────────────────────────────

  app.post("/run", async (c) => {
    try {
      const body = await c.req.json();
      const { agentId, input, sessionId } = body;

      if (!agentId) {
        return c.json({ error: "Missing required field: agentId" }, 400);
      }

      // Resolve the agent manifest
      const manifest = await resolveManifest(agentId, runner);

      // Execute
      const result = await execute(manifest, input ?? "", ctx);

      return c.json({
        output: result.output,
        state: result.state,
      });
    } catch (error) {
      const status = isNotFound(error) ? 404 : 500;
      return c.json({ error: errorMessage(error) }, status);
    }
  });

  // ─── Run with streaming (SSE) ─────────────────────────────────────

  app.post("/run/stream", async (c) => {
    try {
      const body = await c.req.json();
      const { agentId, input, sessionId } = body;

      if (!agentId) {
        return c.json({ error: "Missing required field: agentId" }, 400);
      }

      const manifest = await resolveManifest(agentId, runner);

      return streamSSE(c, async (stream) => {
        try {
          // For now, execute and emit events
          // TODO: integrate with core runner's streaming for LLM agents
          await stream.writeSSE({
            event: "run-start",
            data: JSON.stringify({ agentId, kind: manifest.kind }),
          });

          const result = await execute(manifest, input ?? "", ctx);

          await stream.writeSSE({
            event: "run-complete",
            data: JSON.stringify({
              output: result.output,
              state: result.state,
            }),
          });
        } catch (error) {
          await stream.writeSSE({
            event: "run-error",
            data: JSON.stringify({ error: errorMessage(error) }),
          });
        }
      });
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 500);
    }
  });

  return app;
}

/**
 * Resolve an agent ID to its manifest.
 * Agents are stored with their YAML manifest in metadata.
 */
async function resolveManifest(agentId: string, runner: Runner): Promise<AgentManifest> {
  const agentDef = await runner.agents.getAgent(agentId);
  if (!agentDef) {
    throw Object.assign(new Error(`Agent "${agentId}" not found`), { code: "NOT_FOUND" });
  }

  const metadata = agentDef.metadata as Record<string, unknown> | undefined;
  if (metadata?.manifest && typeof metadata.manifest === "string") {
    return parseManifest(metadata.manifest);
  }

  throw new Error(
    `Agent "${agentId}" does not have a manifest. Store with metadata.manifest (YAML string).`
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isNotFound(error: unknown): boolean {
  if (error instanceof Error) {
    return (error as Error & { code?: string }).code === "NOT_FOUND" ||
      error.constructor.name === "AgentNotFoundError";
  }
  return false;
}
