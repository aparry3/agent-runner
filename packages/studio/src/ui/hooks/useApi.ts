import { useState, useEffect, useCallback } from "react";

const BASE = "/api";

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return res.json();
}

export function useQuery<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<T>(path);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export const api = {
  // Agents
  listAgents: () => apiFetch<any[]>("/agents"),
  getAgent: (id: string) => apiFetch<any>(`/agents/${id}`),
  putAgent: (id: string, agent: any) =>
    apiFetch<any>(`/agents/${id}`, { method: "PUT", body: JSON.stringify(agent) }),
  deleteAgent: (id: string) =>
    apiFetch<void>(`/agents/${id}`, { method: "DELETE" }),
  invokeAgent: (id: string, body: any) =>
    apiFetch<any>(`/agents/${id}/invoke`, { method: "POST", body: JSON.stringify(body) }),

  // Tools
  listTools: () => apiFetch<any[]>("/tools"),
  getTool: (name: string) => apiFetch<any>(`/tools/${name}`),
  testTool: (name: string, input: any) =>
    apiFetch<any>(`/tools/${name}/test`, { method: "POST", body: JSON.stringify(input) }),

  // Sessions
  listSessions: () => apiFetch<any[]>("/sessions"),
  getSession: (id: string) => apiFetch<any>(`/sessions/${id}`),
  deleteSession: (id: string) =>
    apiFetch<void>(`/sessions/${id}`, { method: "DELETE" }),

  // Context
  listContext: () => apiFetch<any[]>("/context"),
  getContext: (id: string) => apiFetch<any>(`/context/${id}`),
  putContext: (id: string, body: any) =>
    apiFetch<any>(`/context/${id}`, { method: "POST", body: JSON.stringify(body) }),
  deleteContext: (id: string) =>
    apiFetch<void>(`/context/${id}`, { method: "DELETE" }),

  // Logs
  listLogs: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiFetch<any>(`/logs${query}`);
  },
  getLog: (id: string) => apiFetch<any>(`/logs/${id}`),

  // Evals
  runEval: (agentId: string) =>
    apiFetch<any>(`/evals/${agentId}/run`, { method: "POST" }),

  // MCP
  listMCPServers: () => apiFetch<any>("/mcp/servers"),
};
