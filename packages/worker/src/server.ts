#!/usr/bin/env node
import { serve } from "@hono/node-server";
import { createRunner } from "@agent-runner/core";
import { createWorkerAPI } from "./routes.js";

const port = Number(process.env.PORT ?? 4001);
const hostname = process.env.HOSTNAME ?? "0.0.0.0";

// Initialize runner with store from environment
// In production, this would connect to the shared Postgres store
const runner = createRunner({
  // Store will be configured via environment variables
  // For now, uses in-memory store as default
  defaults: {
    model: {
      provider: process.env.DEFAULT_MODEL_PROVIDER ?? "openai",
      name: process.env.DEFAULT_MODEL_NAME ?? "gpt-4o",
    },
  },
});

const app = createWorkerAPI({ runner });

serve({
  fetch: app.fetch,
  port,
  hostname,
});

console.log(`Agent Runner Worker listening on http://${hostname}:${port}`);
