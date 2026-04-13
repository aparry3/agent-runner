import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
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
 * JSON file store implementation. Stores all data as JSON files on disk.
 * Good for local development and prototyping.
 *
 * Layout:
 *   data/
 *   ├── agents/
 *   │   ├── writer.json
 *   │   └── reviewer.json
 *   ├── sessions/
 *   │   └── sess_abc123.json
 *   ├── context/
 *   │   └── ctx_project.json
 *   └── logs/
 *       └── inv_xyz789.json
 */
export class JsonFileStore implements UnifiedStore {
  private basePath: string;
  private initialized = false;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  private async ensureDirs(): Promise<void> {
    if (this.initialized) return;
    await mkdir(join(this.basePath, "agents"), { recursive: true });
    await mkdir(join(this.basePath, "sessions"), { recursive: true });
    await mkdir(join(this.basePath, "context"), { recursive: true });
    await mkdir(join(this.basePath, "logs"), { recursive: true });
    await mkdir(join(this.basePath, "providers"), { recursive: true });
    this.initialized = true;
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

  // ═══ AgentStore ═══

  async getAgent(id: string): Promise<AgentDefinition | null> {
    await this.ensureDirs();
    return this.readJson<AgentDefinition>(
      join(this.basePath, "agents", `${this.sanitizeFilename(id)}.json`)
    );
  }

  async listAgents(): Promise<Array<{ id: string; name: string; description?: string }>> {
    await this.ensureDirs();
    const dir = join(this.basePath, "agents");
    const files = await readdir(dir).catch(() => []);
    const agents: Array<{ id: string; name: string; description?: string }> = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const agent = await this.readJson<AgentDefinition>(join(dir, file));
      if (agent) {
        agents.push({ id: agent.id, name: agent.name, description: agent.description });
      }
    }

    return agents;
  }

  async putAgent(agent: AgentDefinition): Promise<void> {
    await this.ensureDirs();
    await this.writeJson(
      join(this.basePath, "agents", `${this.sanitizeFilename(agent.id)}.json`),
      { ...agent, updatedAt: new Date().toISOString() }
    );
  }

  async deleteAgent(id: string): Promise<void> {
    await this.ensureDirs();
    const path = join(this.basePath, "agents", `${this.sanitizeFilename(id)}.json`);
    await unlink(path).catch(() => {});
  }

  // ═══ SessionStore ═══

  async getMessages(sessionId: string): Promise<Message[]> {
    await this.ensureDirs();
    const data = await this.readJson<{ messages: Message[] }>(
      join(this.basePath, "sessions", `${this.sanitizeFilename(sessionId)}.json`)
    );
    return data?.messages ?? [];
  }

  async append(sessionId: string, messages: Message[]): Promise<void> {
    await this.ensureDirs();
    const path = join(this.basePath, "sessions", `${this.sanitizeFilename(sessionId)}.json`);
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
    await this.ensureDirs();
    const path = join(this.basePath, "sessions", `${this.sanitizeFilename(sessionId)}.json`);
    await unlink(path).catch(() => {});
  }

  async listSessions(_agentId?: string): Promise<SessionSummary[]> {
    await this.ensureDirs();
    const dir = join(this.basePath, "sessions");
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

  async getContext(contextId: string): Promise<ContextEntry[]> {
    await this.ensureDirs();
    const data = await this.readJson<{ entries: ContextEntry[] }>(
      join(this.basePath, "context", `${this.sanitizeFilename(contextId)}.json`)
    );
    return data?.entries ?? [];
  }

  async addContext(contextId: string, entry: ContextEntry): Promise<void> {
    await this.ensureDirs();
    const path = join(this.basePath, "context", `${this.sanitizeFilename(contextId)}.json`);
    const existing = await this.readJson<{ entries: ContextEntry[] }>(path);
    const entries = [...(existing?.entries ?? []), entry];
    await this.writeJson(path, { contextId, entries });
  }

  async clearContext(contextId: string): Promise<void> {
    await this.ensureDirs();
    const path = join(this.basePath, "context", `${this.sanitizeFilename(contextId)}.json`);
    await unlink(path).catch(() => {});
  }

  // ═══ LogStore ═══

  async log(entry: InvocationLog): Promise<void> {
    await this.ensureDirs();
    await this.writeJson(
      join(this.basePath, "logs", `${this.sanitizeFilename(entry.id)}.json`),
      entry
    );
  }

  async getLogs(filter?: LogFilter): Promise<InvocationLog[]> {
    await this.ensureDirs();
    const dir = join(this.basePath, "logs");
    const files = await readdir(dir).catch(() => []);
    let logs: InvocationLog[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const log = await this.readJson<InvocationLog>(join(dir, file));
      if (log) logs.push(log);
    }

    if (filter?.agentId) {
      logs = logs.filter(l => l.agentId === filter.agentId);
    }
    if (filter?.sessionId) {
      logs = logs.filter(l => l.sessionId === filter.sessionId);
    }
    if (filter?.since) {
      logs = logs.filter(l => l.timestamp >= filter.since!);
    }

    logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (filter?.offset) {
      logs = logs.slice(filter.offset);
    }
    if (filter?.limit) {
      logs = logs.slice(0, filter.limit);
    }

    return logs;
  }

  async getLog(id: string): Promise<InvocationLog | null> {
    await this.ensureDirs();
    return this.readJson<InvocationLog>(
      join(this.basePath, "logs", `${this.sanitizeFilename(id)}.json`)
    );
  }

  // ═══ ProviderStore ═══

  async getProvider(id: string): Promise<ProviderConfig | null> {
    await this.ensureDirs();
    return this.readJson<ProviderConfig>(
      join(this.basePath, "providers", `${this.sanitizeFilename(id)}.json`)
    );
  }

  async listProviders(): Promise<Array<{ id: string; configured: boolean }>> {
    await this.ensureDirs();
    const dir = join(this.basePath, "providers");
    try {
      const files = await readdir(dir);
      const result: Array<{ id: string; configured: boolean }> = [];
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const provider = await this.readJson<ProviderConfig>(join(dir, file));
        if (provider) {
          result.push({ id: provider.id, configured: !!provider.apiKey });
        }
      }
      return result;
    } catch {
      return [];
    }
  }

  async putProvider(provider: ProviderConfig): Promise<void> {
    await this.ensureDirs();
    const filePath = join(this.basePath, "providers", `${this.sanitizeFilename(provider.id)}.json`);
    await writeFile(filePath, JSON.stringify({ ...provider, updatedAt: new Date().toISOString() }, null, 2));
  }

  async deleteProvider(id: string): Promise<void> {
    await this.ensureDirs();
    const filePath = join(this.basePath, "providers", `${this.sanitizeFilename(id)}.json`);
    try {
      await unlink(filePath);
    } catch {
      // file doesn't exist, that's fine
    }
  }
}
