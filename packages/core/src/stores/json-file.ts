import { readFile, writeFile, mkdir, readdir, unlink, rm } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type {
  AgentDefinition,
  AgentVersionSummary,
  ProviderConfig,
  UnifiedStore,
  Workspace,
  ApiKeyRecord,
  Message,
  SessionSummary,
  ContextEntry,
  InvocationLog,
  LogFilter,
} from "../types.js";

interface StoredAgentVersion {
  agent: AgentDefinition;
  createdAt: string;
  activatedAt: string | null;
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
 * JSON file store. Workspace-scoped data lives under
 *   basePath/workspaces/<workspaceId>/{agents,sessions,context,logs,providers}/
 * Workspace + API key registries are top-level JSON files.
 */
export class JsonFileStore implements UnifiedStore {
  private basePath: string;
  readonly workspaceId: string | null;
  private lastTs = 0;

  constructor(basePath: string, workspaceId?: string) {
    this.basePath = basePath;
    this.workspaceId = workspaceId ?? null;
  }

  forWorkspace(workspaceId: string): JsonFileStore {
    return new JsonFileStore(this.basePath, workspaceId);
  }

  private requireWorkspace(): string {
    if (!this.workspaceId) {
      throw new Error("JsonFileStore: workspace not set. Call forWorkspace(id) first.");
    }
    return this.workspaceId;
  }

  private nextTimestamp(): string {
    const now = Date.now();
    const next = now > this.lastTs ? now : this.lastTs + 1;
    this.lastTs = next;
    return new Date(next).toISOString();
  }

  private wsRoot(): string {
    return join(this.basePath, "workspaces", this.requireWorkspace());
  }

  private async ensureWorkspaceDirs(): Promise<void> {
    const root = this.wsRoot();
    await mkdir(join(root, "agents"), { recursive: true });
    await mkdir(join(root, "sessions"), { recursive: true });
    await mkdir(join(root, "context"), { recursive: true });
    await mkdir(join(root, "logs"), { recursive: true });
    await mkdir(join(root, "providers"), { recursive: true });
  }

  private async readJson<T>(path: string): Promise<T | null> {
    try {
      const data = await readFile(path, "utf-8");
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  private async writeJson(path: string, data: unknown): Promise<void> {
    await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
  }

  private sanitizeFilename(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  private filenameSafeTimestamp(ts: string): string {
    return ts.replace(/:/g, "-");
  }

  // ═══ AgentStore ═══

  private agentDir(id: string): string {
    return join(this.wsRoot(), "agents", this.sanitizeFilename(id));
  }

  private async readAllVersions(agentId: string): Promise<StoredAgentVersion[]> {
    const dir = this.agentDir(agentId);
    const files = await readdir(dir).catch(() => []);
    const versions: StoredAgentVersion[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const v = await this.readJson<StoredAgentVersion>(join(dir, file));
      if (v) versions.push(v);
    }
    return versions;
  }

  async getAgent(id: string): Promise<AgentDefinition | null> {
    await this.ensureWorkspaceDirs();
    const versions = await this.readAllVersions(id);
    if (versions.length === 0) return null;
    const active = versions.filter((v) => v.activatedAt !== null);
    if (active.length > 0) {
      active.sort((a, b) => b.activatedAt!.localeCompare(a.activatedAt!));
      return active[0].agent;
    }
    versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return versions[0].agent;
  }

  async listAgents(): Promise<Array<{ id: string; name: string; description?: string }>> {
    await this.ensureWorkspaceDirs();
    const root = join(this.wsRoot(), "agents");
    const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
    const agents: Array<{ id: string; name: string; description?: string }> = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const agent = await this.getAgent(entry.name);
      if (agent) {
        agents.push({ id: agent.id, name: agent.name, description: agent.description });
      }
    }

    return agents.sort((a, b) => a.name.localeCompare(b.name));
  }

  async putAgent(agent: AgentDefinition): Promise<void> {
    await this.ensureWorkspaceDirs();
    const dir = this.agentDir(agent.id);
    await mkdir(dir, { recursive: true });
    const now = this.nextTimestamp();
    const stored: StoredAgentVersion = {
      agent: { ...agent, createdAt: now, updatedAt: now },
      createdAt: now,
      activatedAt: now,
    };
    await this.writeJson(join(dir, `${this.filenameSafeTimestamp(now)}.json`), stored);
  }

  async deleteAgent(id: string): Promise<void> {
    await this.ensureWorkspaceDirs();
    await rm(this.agentDir(id), { recursive: true, force: true });
  }

  async listAgentVersions(agentId: string): Promise<AgentVersionSummary[]> {
    await this.ensureWorkspaceDirs();
    const versions = await this.readAllVersions(agentId);
    return versions
      .map((v) => ({ createdAt: v.createdAt, activatedAt: v.activatedAt }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getAgentVersion(agentId: string, createdAt: string): Promise<AgentDefinition | null> {
    await this.ensureWorkspaceDirs();
    const path = join(this.agentDir(agentId), `${this.filenameSafeTimestamp(createdAt)}.json`);
    const v = await this.readJson<StoredAgentVersion>(path);
    return v?.agent ?? null;
  }

  async activateAgentVersion(agentId: string, createdAt: string): Promise<void> {
    await this.ensureWorkspaceDirs();
    const path = join(this.agentDir(agentId), `${this.filenameSafeTimestamp(createdAt)}.json`);
    const v = await this.readJson<StoredAgentVersion>(path);
    if (!v) return;
    v.activatedAt = this.nextTimestamp();
    await this.writeJson(path, v);
  }

  // ═══ SessionStore ═══

  private sessionPath(sessionId: string): string {
    return join(this.wsRoot(), "sessions", `${this.sanitizeFilename(sessionId)}.json`);
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    await this.ensureWorkspaceDirs();
    const data = await this.readJson<{ messages: Message[] }>(this.sessionPath(sessionId));
    return data?.messages ?? [];
  }

  async append(sessionId: string, messages: Message[]): Promise<void> {
    await this.ensureWorkspaceDirs();
    const path = this.sessionPath(sessionId);
    const existing = await this.readJson<{ messages: Message[]; createdAt: string }>(path);
    const now = new Date().toISOString();

    await this.writeJson(path, {
      sessionId,
      messages: [...(existing?.messages ?? []), ...messages],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.ensureWorkspaceDirs();
    await unlink(this.sessionPath(sessionId)).catch(() => {});
  }

  async listSessions(_agentId?: string): Promise<SessionSummary[]> {
    await this.ensureWorkspaceDirs();
    const dir = join(this.wsRoot(), "sessions");
    const files = await readdir(dir).catch(() => []);
    const sessions: SessionSummary[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const data = await this.readJson<{
        sessionId: string;
        messages: Message[];
        createdAt: string;
        updatedAt: string;
      }>(join(dir, file));
      if (data) {
        sessions.push({
          sessionId: data.sessionId,
          messageCount: data.messages?.length ?? 0,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      }
    }

    return sessions;
  }

  // ═══ ContextStore ═══

  private contextPath(contextId: string): string {
    return join(this.wsRoot(), "context", `${this.sanitizeFilename(contextId)}.json`);
  }

  async getContext(contextId: string): Promise<ContextEntry[]> {
    await this.ensureWorkspaceDirs();
    const data = await this.readJson<{ entries: ContextEntry[] }>(this.contextPath(contextId));
    return data?.entries ?? [];
  }

  async addContext(contextId: string, entry: ContextEntry): Promise<void> {
    await this.ensureWorkspaceDirs();
    const path = this.contextPath(contextId);
    const existing = await this.readJson<{ entries: ContextEntry[] }>(path);
    const entries = [...(existing?.entries ?? []), entry];
    await this.writeJson(path, { contextId, entries });
  }

  async clearContext(contextId: string): Promise<void> {
    await this.ensureWorkspaceDirs();
    await unlink(this.contextPath(contextId)).catch(() => {});
  }

  // ═══ LogStore ═══

  async log(entry: InvocationLog): Promise<void> {
    await this.ensureWorkspaceDirs();
    await this.writeJson(
      join(this.wsRoot(), "logs", `${this.sanitizeFilename(entry.id)}.json`),
      entry
    );
  }

  async getLogs(filter?: LogFilter): Promise<InvocationLog[]> {
    await this.ensureWorkspaceDirs();
    const dir = join(this.wsRoot(), "logs");
    const files = await readdir(dir).catch(() => []);
    let logs: InvocationLog[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const log = await this.readJson<InvocationLog>(join(dir, file));
      if (log) logs.push(log);
    }

    if (filter?.agentId) logs = logs.filter(l => l.agentId === filter.agentId);
    if (filter?.sessionId) logs = logs.filter(l => l.sessionId === filter.sessionId);
    if (filter?.since) logs = logs.filter(l => l.timestamp >= filter.since!);

    logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (filter?.offset) logs = logs.slice(filter.offset);
    if (filter?.limit) logs = logs.slice(0, filter.limit);

    return logs;
  }

  async getLog(id: string): Promise<InvocationLog | null> {
    await this.ensureWorkspaceDirs();
    return this.readJson<InvocationLog>(
      join(this.wsRoot(), "logs", `${this.sanitizeFilename(id)}.json`)
    );
  }

  // ═══ ProviderStore ═══

  private providerPath(id: string): string {
    return join(this.wsRoot(), "providers", `${this.sanitizeFilename(id)}.json`);
  }

  async getProvider(id: string): Promise<ProviderConfig | null> {
    await this.ensureWorkspaceDirs();
    return this.readJson<ProviderConfig>(this.providerPath(id));
  }

  async listProviders(): Promise<Array<{ id: string; configured: boolean }>> {
    await this.ensureWorkspaceDirs();
    const dir = join(this.wsRoot(), "providers");
    const files = await readdir(dir).catch(() => []);
    const result: Array<{ id: string; configured: boolean }> = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const provider = await this.readJson<ProviderConfig>(join(dir, file));
      if (provider) {
        result.push({ id: provider.id, configured: !!provider.apiKey });
      }
    }
    return result;
  }

  async putProvider(provider: ProviderConfig): Promise<void> {
    await this.ensureWorkspaceDirs();
    await this.writeJson(this.providerPath(provider.id), {
      ...provider,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteProvider(id: string): Promise<void> {
    await this.ensureWorkspaceDirs();
    await unlink(this.providerPath(id)).catch(() => {});
  }

  // ═══ WorkspaceStore (admin — no scoping) ═══

  private workspacesPath(): string {
    return join(this.basePath, "workspaces.json");
  }

  private async readWorkspaces(): Promise<Record<string, Workspace>> {
    return (await this.readJson<Record<string, Workspace>>(this.workspacesPath())) ?? {};
  }

  private async writeWorkspaces(map: Record<string, Workspace>): Promise<void> {
    await mkdir(this.basePath, { recursive: true });
    await this.writeJson(this.workspacesPath(), map);
  }

  async getWorkspaceByClerkOrgId(clerkOrgId: string): Promise<Workspace | null> {
    const all = await this.readWorkspaces();
    return Object.values(all).find(w => w.clerkOrgId === clerkOrgId) ?? null;
  }

  async getWorkspaceById(id: string): Promise<Workspace | null> {
    const all = await this.readWorkspaces();
    return all[id] ?? null;
  }

  async createWorkspace(params: { clerkOrgId: string; name: string }): Promise<Workspace> {
    const all = await this.readWorkspaces();
    const existing = Object.values(all).find(w => w.clerkOrgId === params.clerkOrgId);
    if (existing) return existing;
    const ws: Workspace = {
      id: randomUUID(),
      clerkOrgId: params.clerkOrgId,
      name: params.name,
      createdAt: new Date().toISOString(),
    };
    all[ws.id] = ws;
    await this.writeWorkspaces(all);
    return ws;
  }

  // ═══ ApiKeyStore (admin — no scoping) ═══

  private apiKeysPath(): string {
    return join(this.basePath, "api-keys.json");
  }

  private async readApiKeys(): Promise<ApiKeyRow[]> {
    return (await this.readJson<ApiKeyRow[]>(this.apiKeysPath())) ?? [];
  }

  private async writeApiKeys(rows: ApiKeyRow[]): Promise<void> {
    await mkdir(this.basePath, { recursive: true });
    await this.writeJson(this.apiKeysPath(), rows);
  }

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
    const rows = await this.readApiKeys();
    rows.push(row);
    await this.writeApiKeys(rows);
    return { record: rowToRecord(row), rawKey };
  }

  async listApiKeys(workspaceId: string): Promise<ApiKeyRecord[]> {
    const rows = await this.readApiKeys();
    return rows
      .filter(r => r.workspaceId === workspaceId)
      .map(rowToRecord)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async revokeApiKey(params: { workspaceId: string; keyId: string }): Promise<void> {
    const rows = await this.readApiKeys();
    const row = rows.find(r => r.id === params.keyId && r.workspaceId === params.workspaceId);
    if (!row) return;
    row.revokedAt = new Date().toISOString();
    await this.writeApiKeys(rows);
  }

  async resolveApiKey(rawKey: string): Promise<{ workspaceId: string; keyId: string } | null> {
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const rows = await this.readApiKeys();
    const row = rows.find(r => r.keyHash === keyHash && !r.revokedAt);
    if (!row) return null;
    row.lastUsedAt = new Date().toISOString();
    await this.writeApiKeys(rows);
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
