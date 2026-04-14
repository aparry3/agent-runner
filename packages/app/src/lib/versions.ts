import type { AgentDefinition, AgentVersionSummary } from "@agent-runner/core";
import { getStore } from "./store";

/**
 * List all versions for an agent, most recent first.
 */
export async function listVersions(agentId: string): Promise<AgentVersionSummary[]> {
  const store = await getStore();
  return store.listAgentVersions(agentId);
}

/**
 * Get a specific version's agent definition by agent ID and created_at timestamp.
 */
export async function getVersion(agentId: string, createdAt: string): Promise<AgentDefinition | null> {
  const store = await getStore();
  return store.getAgentVersion(agentId, createdAt);
}

/**
 * Activate a specific version (set its activated_at to now).
 */
export async function activateVersion(agentId: string, createdAt: string): Promise<void> {
  const store = await getStore();
  await store.activateAgentVersion(agentId, createdAt);
}
