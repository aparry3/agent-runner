import { getStore } from "./store";

interface VersionSummary {
  createdAt: string;
  activatedAt: string | null;
}

/**
 * List all versions for an agent, most recent first.
 */
export async function listVersions(agentId: string): Promise<VersionSummary[]> {
  const store = await getStore();

  if ("listAgentVersions" in store && typeof store.listAgentVersions === "function") {
    return store.listAgentVersions(agentId) as VersionSummary[];
  }

  return [];
}

/**
 * Get a specific version's agent definition by agent ID and created_at timestamp.
 */
export async function getVersion(agentId: string, createdAt: string) {
  const store = await getStore();

  if ("getAgentVersion" in store && typeof store.getAgentVersion === "function") {
    return store.getAgentVersion(agentId, createdAt);
  }

  return null;
}

/**
 * Activate a specific version (set its activated_at to now).
 */
export async function activateVersion(agentId: string, createdAt: string): Promise<void> {
  const store = await getStore();

  if ("activateAgentVersion" in store && typeof store.activateAgentVersion === "function") {
    store.activateAgentVersion(agentId, createdAt);
  }
}
