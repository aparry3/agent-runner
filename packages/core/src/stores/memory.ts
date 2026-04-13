import type {
  AgentDefinition,
  AgentStore,
  SessionStore,
  ContextStore,
  LogStore,
  ProviderStore,
  ProviderConfig,
  UnifiedStore,
  Message,
  SessionSummary,
  ContextEntry,
  InvocationLog,
  LogFilter,
} from "../types.js";

/**
 * In-memory store implementation. Useful for testing and ephemeral usage.
 * All data is lost when the process exits.
 */
interface AgentVersion {
  agent: AgentDefinition;
  createdAt: string;
  activatedAt: string | null;
}

export class MemoryStore implements UnifiedStore {
  private agentVersions = new Map<string, AgentVersion[]>();
  private sessions = new Map<string, { agentId?: string; messages: Message[]; createdAt: string; updatedAt: string }>();
  private contexts = new Map<string, ContextEntry[]>();
  private logs: InvocationLog[] = [];
  private providers = new Map<string, ProviderConfig>();

  // ═══ AgentStore ═══

  async getAgent(id: string): Promise<AgentDefinition | null> {
    const versions = this.agentVersions.get(id);
    if (!versions || versions.length === 0) return null;
    // Find the version with the most recent activatedAt
    const active = versions
      .filter(v => v.activatedAt !== null)
      .sort((a, b) => b.activatedAt!.localeCompare(a.activatedAt!));
    if (active.length > 0) return active[0].agent;
    // Fallback to most recent by createdAt
    return versions[versions.length - 1].agent;
  }

  async listAgents(): Promise<Array<{ id: string; name: string; description?: string }>> {
    const result: Array<{ id: string; name: string; description?: string }> = [];
    for (const [id] of this.agentVersions) {
      const agent = await this.getAgent(id);
      if (agent) {
        result.push({ id: agent.id, name: agent.name, description: agent.description });
      }
    }
    return result;
  }

  async putAgent(agent: AgentDefinition): Promise<void> {
    const now = new Date().toISOString();
    const versions = this.agentVersions.get(agent.id) ?? [];
    versions.push({
      agent: { ...agent, createdAt: now, updatedAt: now },
      createdAt: now,
      activatedAt: now,
    });
    this.agentVersions.set(agent.id, versions);
  }

  async deleteAgent(id: string): Promise<void> {
    this.agentVersions.delete(id);
  }

  // ═══ Agent Versions ═══

  listAgentVersions(agentId: string): Array<{ createdAt: string; activatedAt: string | null }> {
    const versions = this.agentVersions.get(agentId) ?? [];
    return versions
      .map(v => ({ createdAt: v.createdAt, activatedAt: v.activatedAt }))
      .reverse();
  }

  getAgentVersion(agentId: string, createdAt: string): AgentDefinition | null {
    const versions = this.agentVersions.get(agentId) ?? [];
    const found = versions.find(v => v.createdAt === createdAt);
    return found?.agent ?? null;
  }

  activateAgentVersion(agentId: string, createdAt: string): void {
    const versions = this.agentVersions.get(agentId) ?? [];
    const found = versions.find(v => v.createdAt === createdAt);
    if (found) {
      found.activatedAt = new Date().toISOString();
    }
  }

  // ═══ SessionStore ═══

  async getMessages(sessionId: string): Promise<Message[]> {
    return this.sessions.get(sessionId)?.messages ?? [];
  }

  async append(sessionId: string, messages: Message[]): Promise<void> {
    const now = new Date().toISOString();
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages.push(...messages);
      session.updatedAt = now;
    } else {
      this.sessions.set(sessionId, {
        messages: [...messages],
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async listSessions(agentId?: string): Promise<SessionSummary[]> {
    const result: SessionSummary[] = [];
    for (const [sessionId, session] of this.sessions) {
      if (agentId && session.agentId !== agentId) continue;
      result.push({
        sessionId,
        agentId: session.agentId,
        messageCount: session.messages.length,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      });
    }
    return result;
  }

  // ═══ ContextStore ═══

  async getContext(contextId: string): Promise<ContextEntry[]> {
    return this.contexts.get(contextId) ?? [];
  }

  async addContext(contextId: string, entry: ContextEntry): Promise<void> {
    const entries = this.contexts.get(contextId) ?? [];
    entries.push(entry);
    this.contexts.set(contextId, entries);
  }

  async clearContext(contextId: string): Promise<void> {
    this.contexts.delete(contextId);
  }

  // ═══ LogStore ═══

  async log(entry: InvocationLog): Promise<void> {
    this.logs.push(entry);
  }

  async getLogs(filter?: LogFilter): Promise<InvocationLog[]> {
    let result = [...this.logs];

    if (filter?.agentId) {
      result = result.filter(l => l.agentId === filter.agentId);
    }
    if (filter?.sessionId) {
      result = result.filter(l => l.sessionId === filter.sessionId);
    }
    if (filter?.since) {
      result = result.filter(l => l.timestamp >= filter.since!);
    }

    // Sort by timestamp descending (newest first)
    result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (filter?.offset) {
      result = result.slice(filter.offset);
    }
    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  async getLog(id: string): Promise<InvocationLog | null> {
    return this.logs.find(l => l.id === id) ?? null;
  }

  // ═══ ProviderStore ═══

  async getProvider(id: string): Promise<ProviderConfig | null> {
    return this.providers.get(id) ?? null;
  }

  async listProviders(): Promise<Array<{ id: string; configured: boolean }>> {
    return Array.from(this.providers.values()).map(p => ({
      id: p.id,
      configured: !!p.apiKey,
    }));
  }

  async putProvider(provider: ProviderConfig): Promise<void> {
    this.providers.set(provider.id, { ...provider, updatedAt: new Date().toISOString() });
  }

  async deleteProvider(id: string): Promise<void> {
    this.providers.delete(id);
  }
}
