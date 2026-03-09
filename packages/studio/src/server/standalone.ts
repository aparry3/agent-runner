import { serve } from "@hono/node-server";
import type { Runner } from "agent-runner";
import { createStudioAPI } from "./api.js";

export interface StudioOptions {
  /** Port to listen on (default: 4000) */
  port?: number;
  /** Hostname to bind to (default: "localhost") */
  hostname?: string;
  /** Callback when the server starts */
  onReady?: (url: string) => void;
}

/**
 * Create and start a standalone Studio server.
 *
 * @example
 * ```ts
 * import { createRunner } from "agent-runner";
 * import { createStudio } from "@agent-runner/studio";
 *
 * const runner = createRunner({ ... });
 * const studio = await createStudio(runner, { port: 4000 });
 * // Studio is now running at http://localhost:4000
 * ```
 */
export async function createStudio(runner: Runner, options: StudioOptions = {}) {
  const port = options.port ?? 4000;
  const hostname = options.hostname ?? "localhost";
  const app = createStudioAPI(runner);

  const server = serve({
    fetch: app.fetch,
    port,
    hostname,
  });

  const url = `http://${hostname}:${port}`;
  options.onReady?.(url);

  return {
    url,
    app,
    close: () => {
      return new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}
