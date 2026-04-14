import { createHash, randomBytes, randomUUID } from "node:crypto";
import type {
  AgentDefinition,
  AgentStore,
  SessionStore,
  ContextStore,
  LogStore,
  ProviderStore,
  ProviderConfig,
  UnifiedStore,
  WorkspaceStore,
  ApiKeyStore,
  Workspace,
  ApiKeyRecord,
  Message,
  SessionSummary,
  ContextEntry,
  InvocationLog,
  LogFilter,
} from "../types.js";

interface AgentVersion {
  agent: AgentDefinition;
  createdAt: string;
  activatedAt: string | null;
}

interface SessionRow {
  workspaceId: string;
  agentId?: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface ApiKeyRow {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/**
 * Shared backing state across MemoryStore instances created via forWorkspace().
 * Hoisted out of the class so scoped instances see the same data.
 */
interface MemoryBackend {
  agentVersions: Map<string, Map<string, AgentVersion[]>>; // workspaceId -> agentId -> versions
  sessions: Map<string, SessionRow>; // sessionId -> row (sessions are global ids, but row carries workspaceId)
  contexts: Map<string, { workspaceId: string; entries: ContextEntry[] }>;
  logs: Array<{ workspaceId: string; log: InvocationLog }>;
  providers: Map<string, Map<string, ProviderConfig>>; // workspaceId -> providerId -> config
  workspaces: Map<string, Workspace>; // id -> workspace
  workspacesByOrg: Map<string, Workspace>; // clerkOrgId -> workspace
  apiKeys: Map<string, ApiKeyRow>; // id -> row
  apiKeyByHash: Map<string, ApiKeyRow>; // sha256(rawKey) -> row
}

function createBackend(): MemoryBackend {
  return {
    agentVersions: new Map(),
    sessions: new Map(),
    contexts: new Map(),
    logs: [],
    providers: new Map(),
    workspaces: new Map(),
    workspacesByOrg: new Map(),
    apiKeys: new Map(),
    apiKeyByHash: new Map(),
  };
}

/**
 * MemoryStore is the default store for quick-start / test usage. Unlike
 * PostgresStore / SqliteStore, it auto-scopes to a "__default__" workspace
 * when constructed without explicit workspaceId so tests and single-tenant
 * demos don't need forWorkspace() ceremony. Multi-tenant callers still use
 * forWorkspace() as normal.
 */
const DEFAULT_WORKSPACE_ID = "__default__";

export class MemoryStore implements UnifiedStore {
  private backend: MemoryBackend;
  readonly workspaceId: string | null;
  private lastTs = 0;

  constructor(opts: { workspaceId?: string; backend?: MemoryBackend; strict?: boolean } = {}) {
    this.backend = opts.backend ?? createBackend();
    if (opts.workspaceId !== undefined) {
      this.workspaceId = opts.workspaceId;
    } else if (opts.strict) {
      this.workspaceId = null;
    } else {
      // Ergonomic default: auto-scope to a singleton workspace.
      this.workspaceId = DEFAULT_WORKSPACE_ID;
      if (!this.backend.workspaces.has(DEFAULT_WORKSPACE_ID)) {
        const now = new Date().toISOString();
        const ws: Workspace = {
          id: DEFAULT_WORKSPACE_ID,
          clerkOrgId: DEFAULT_WORKSPACE_ID,
          name: "Default",
          createdAt: now,
        };
        this.backend.workspaces.set(ws.id, ws);
        this.backend.workspacesByOrg.set(ws.clerkOrgId, ws);
      }
    }
  }

  forWorkspace(workspaceId: string): MemoryStore {
    return new MemoryStore({ workspaceId, backend: this.backend });
  }

  private requireWorkspace(): string {
    if (!this.workspaceId) {
      throw new Error("MemoryStore: workspace not set. Call forWorkspace(id) first.");
    }
    return this.workspaceId;
  }

  private nextTimestamp(): string {
    const now = Date.now();
    const next = now > this.lastTs ? now : this.lastTs + 1;
    this.lastTs = next;
    return new Date(next).toISOString();
  }

  // ═══ AgentStore ═══

  private agentMap(): Map<string, AgentVersion[]> {
    const ws = this.requireWorkspace();
    let m = this.backend.agentVersions.get(ws);
    if (!m) {
      m = new Map();
      this.backend.agentVersions.set(ws, m);
    }
    return m;
  }

  async getAgent(id: string): Promise<AgentDefinition | null> {
    const versions = this.agentMap().get(id);
    if (!versions || versions.length === 0) return null;
    const active = versions
      .filter(v => v.activatedAt !== null)
      .sort((a, b) => b.activatedAt!.localeCompare(a.activatedAt!));
    if (active.length > 0) return active[0].agent;
    return versions[versions.length - 1].agent;
  }

  async listAgents(): Promise<Array<{ id: string; name: string; description?: string }>> {
    const result: Array<{ id: string; name: string; description?: string }> = [];
    for (const [id] of this.agentMap()) {
      const agent = await this.getAgent(id);
      if (agent) {
        result.push({ id: agent.id, name: agent.name, description: agent.description });
      }
    }
    return result;
  }

  async putAgent(agent: AgentDefinition): Promise<void> {
    const map = this.agentMap();
    const now = this.nextTimestamp();
    const versions = map.get(agent.id) ?? [];
    versions.push({
      agent: { ...agent, createdAt: now, updatedAt: now },
      createdAt: now,
      activatedAt: now,
    });
    map.set(agent.id, versions);
  }

  async deleteAgent(id: string): Promise<void> {
    this.agentMap().delete(id);
  }

  async listAgentVersions(agentId: string): Promise<Array<{ createdAt: string; activatedAt: string | null }>> {
    const versions = this.agentMap().get(agentId) ?? [];
    return versions
      .map(v => ({ createdAt: v.createdAt, activatedAt: v.activatedAt }))
      .reverse();
  }

  async getAgentVersion(agentId: string, createdAt: string): Promise<AgentDefinition | null> {
    const versions = this.agentMap().get(agentId) ?? [];
    const found = versions.find(v => v.createdAt === createdAt);
    return found?.agent ?? null;
  }

  async activateAgentVersion(agentId: string, createdAt: string): Promise<void> {
    const versions = this.agentMap().get(agentId) ?? [];
    const found = versions.find(v => v.createdAt === createdAt);
    if (found) {
      found.activatedAt = this.nextTimestamp();
    }
  }

  // ═══ SessionStore ═══

  async getMessages(sessionId: string): Promise<Message[]> {
    const ws = this.requireWorkspace();
    const session = this.backend.sessions.get(sessionId);
    if (!session || session.workspaceId !== ws) return [];
    return session.messages;
  }

  async append(sessionId: string, messages: Message[]): Promise<void> {
    const ws = this.requireWorkspace();
    const now = new Date().toISOString();
    const session = this.backend.sessions.get(sessionId);
    if (session) {
      if (session.workspaceId !== ws) {
        throw new Error(`Session ${sessionId} belongs to a different workspace`);
      }
      session.messages.push(...messages);
      session.updatedAt = now;
    } else {
      this.backend.sessions.set(sessionId, {
        workspaceId: ws,
        messages: [...messages],
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const ws = this.requireWorkspace();
    const session = this.backend.sessions.get(sessionId);
    if (session && session.workspaceId === ws) {
      this.backend.sessions.delete(sessionId);
    }
  }

  async listSessions(agentId?: string): Promise<SessionSummary[]> {
    const ws = this.requireWorkspace();
    const result: SessionSummary[] = [];
    for (const [sessionId, session] of this.backend.sessions) {
      if (session.workspaceId !== ws) continue;
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
    const ws = this.requireWorkspace();
    const ctx = this.backend.contexts.get(contextId);
    if (!ctx || ctx.workspaceId !== ws) return [];
    return ctx.entries;
  }

  async addContext(contextId: string, entry: ContextEntry): Promise<void> {
    const ws = this.requireWorkspace();
    const existing = this.backend.contexts.get(contextId);
    if (existing) {
      if (existing.workspaceId !== ws) {
        throw new Error(`Context ${contextId} belongs to a different workspace`);
      }
      existing.entries.push(entry);
    } else {
      this.backend.contexts.set(contextId, { workspaceId: ws, entries: [entry] });
    }
  }

  async clearContext(contextId: string): Promise<void> {
    const ws = this.requireWorkspace();
    const existing = this.backend.contexts.get(contextId);
    if (existing && existing.workspaceId === ws) {
      this.backend.contexts.delete(contextId);
    }
  }

  // ═══ LogStore ═══

  async log(entry: InvocationLog): Promise<void> {
    const ws = this.requireWorkspace();
    this.backend.logs.push({ workspaceId: ws, log: entry });
  }

  async getLogs(filter?: LogFilter): Promise<InvocationLog[]> {
    const ws = this.requireWorkspace();
    let result = this.backend.logs.filter(r => r.workspaceId === ws).map(r => r.log);

    if (filter?.agentId) result = result.filter(l => l.agentId === filter.agentId);
    if (filter?.sessionId) result = result.filter(l => l.sessionId === filter.sessionId);
    if (filter?.since) result = result.filter(l => l.timestamp >= filter.since!);

    result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (filter?.offset) result = result.slice(filter.offset);
    if (filter?.limit) result = result.slice(0, filter.limit);

    return result;
  }

  async getLog(id: string): Promise<InvocationLog | null> {
    const ws = this.requireWorkspace();
    const found = this.backend.logs.find(r => r.workspaceId === ws && r.log.id === id);
    return found?.log ?? null;
  }

  // ═══ ProviderStore ═══

  private providerMap(): Map<string, ProviderConfig> {
    const ws = this.requireWorkspace();
    let m = this.backend.providers.get(ws);
    if (!m) {
      m = new Map();
      this.backend.providers.set(ws, m);
    }
    return m;
  }

  async getProvider(id: string): Promise<ProviderConfig | null> {
    return this.providerMap().get(id) ?? null;
  }

  async listProviders(): Promise<Array<{ id: string; configured: boolean }>> {
    return Array.from(this.providerMap().values()).map(p => ({
      id: p.id,
      configured: !!p.apiKey,
    }));
  }

  async putProvider(provider: ProviderConfig): Promise<void> {
    this.providerMap().set(provider.id, { ...provider, updatedAt: new Date().toISOString() });
  }

  async deleteProvider(id: string): Promise<void> {
    this.providerMap().delete(id);
  }

  // ═══ WorkspaceStore (admin — works without scoping) ═══

  async getWorkspaceByClerkOrgId(clerkOrgId: string): Promise<Workspace | null> {
    return this.backend.workspacesByOrg.get(clerkOrgId) ?? null;
  }

  async getWorkspaceById(id: string): Promise<Workspace | null> {
    return this.backend.workspaces.get(id) ?? null;
  }

  async createWorkspace(params: { clerkOrgId: string; name: string }): Promise<Workspace> {
    const existing = this.backend.workspacesByOrg.get(params.clerkOrgId);
    if (existing) return existing;
    const ws: Workspace = {
      id: randomUUID(),
      clerkOrgId: params.clerkOrgId,
      name: params.name,
      createdAt: new Date().toISOString(),
    };
    this.backend.workspaces.set(ws.id, ws);
    this.backend.workspacesByOrg.set(ws.clerkOrgId, ws);
    return ws;
  }

  // ═══ ApiKeyStore (admin — works without scoping) ═══

  async createApiKey(params: { workspaceId: string; name: string }): Promise<{ record: ApiKeyRecord; rawKey: string }> {
    const rawKey = `ar_live_${randomBytes(24).toString("base64url")}`;
    const keyPrefix = rawKey.slice(0, 14);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const row: ApiKeyRow = {
      id: randomUUID(),
      workspaceId: params.workspaceId,
      name: params.name,
      keyPrefix,
      keyHash,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revokedAt: null,
    };
    this.backend.apiKeys.set(row.id, row);
    this.backend.apiKeyByHash.set(keyHash, row);
    return {
      record: rowToRecord(row),
      rawKey,
    };
  }

  async listApiKeys(workspaceId: string): Promise<ApiKeyRecord[]> {
    return Array.from(this.backend.apiKeys.values())
      .filter(r => r.workspaceId === workspaceId)
      .map(rowToRecord)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async revokeApiKey(params: { workspaceId: string; keyId: string }): Promise<void> {
    const row = this.backend.apiKeys.get(params.keyId);
    if (!row || row.workspaceId !== params.workspaceId) return;
    row.revokedAt = new Date().toISOString();
  }

  async resolveApiKey(rawKey: string): Promise<{ workspaceId: string; keyId: string } | null> {
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const row = this.backend.apiKeyByHash.get(keyHash);
    if (!row || row.revokedAt) return null;
    row.lastUsedAt = new Date().toISOString();
    return { workspaceId: row.workspaceId, keyId: row.id };
  }
}

function rowToRecord(row: ApiKeyRow): ApiKeyRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    keyPrefix: row.keyPrefix,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
  };
}
