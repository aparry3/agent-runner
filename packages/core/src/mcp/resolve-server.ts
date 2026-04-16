import type { ConnectionStore, MCPConnectionConfig } from "../types.js";

export interface ResolvedMCPServer {
  url: string;
  headers?: Record<string, string>;
  source: "registered" | "url";
}

/**
 * Turn the `server:` value from an agent manifest into a concrete MCP config.
 * Registry-first: if `ref` matches a registered `kind=mcp` connection id for
 * the user, use that connection's config. Otherwise treat `ref` as a URL.
 */
export async function resolveMCPServer(
  ref: string,
  store: ConnectionStore,
): Promise<ResolvedMCPServer> {
  const registered = await store.getConnection("mcp", ref);
  if (registered) {
    const cfg = registered.config as MCPConnectionConfig;
    return { url: cfg.url, headers: cfg.headers, source: "registered" };
  }
  return { url: ref, source: "url" };
}
