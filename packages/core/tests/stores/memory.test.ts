import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStore } from "../../src/stores/memory.js";
import type { AgentDefinition, Message, ContextEntry, InvocationLog } from "../../src/types.js";

describe("MemoryStore", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  // ═══ AgentStore ═══

  describe("AgentStore", () => {
    const agent: AgentDefinition = {
      id: "test",
      name: "Test Agent",
      systemPrompt: "You are a test.",
      model: { provider: "openai", name: "gpt-4o" },
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    it("stores and retrieves an agent", async () => {
      await store.putAgent(agent);
      const retrieved = await store.getAgent("test");
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe("test");
      expect(retrieved!.name).toBe("Test Agent");
    });

    it("returns null for unknown agent", async () => {
      const result = await store.getAgent("nonexistent");
      expect(result).toBeNull();
    });

    it("lists agents", async () => {
      await store.putAgent(agent);
      await store.putAgent({ ...agent, id: "test2", name: "Test 2" });
      const list = await store.listAgents();
      expect(list).toHaveLength(2);
    });

    it("deletes an agent", async () => {
      await store.putAgent(agent);
      await store.deleteAgent("test");
      const result = await store.getAgent("test");
      expect(result).toBeNull();
    });

    it("creates a version per put and listAgentVersions returns them newest first", async () => {
      await store.putAgent({ ...agent, name: "v1" });
      await store.putAgent({ ...agent, name: "v2" });
      const versions = await store.listAgentVersions("test");
      expect(versions).toHaveLength(2);
      expect(versions[0].createdAt > versions[1].createdAt).toBe(true);
    });

    it("activateAgentVersion changes the active version returned by getAgent", async () => {
      await store.putAgent({ ...agent, name: "v1" });
      await store.putAgent({ ...agent, name: "v2" });
      const versions = await store.listAgentVersions("test");
      await store.activateAgentVersion("test", versions[1].createdAt);
      const active = await store.getAgent("test");
      expect(active?.name).toBe("v1");
    });
  });

  // ═══ SessionStore ═══

  describe("SessionStore", () => {
    const msg: Message = {
      role: "user",
      content: "Hello",
      timestamp: "2026-01-01T00:00:00Z",
    };

    it("appends and retrieves messages", async () => {
      await store.append("sess1", [msg]);
      const messages = await store.getMessages("sess1");
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("Hello");
    });

    it("returns empty array for unknown session", async () => {
      const messages = await store.getMessages("nonexistent");
      expect(messages).toEqual([]);
    });

    it("appends to existing session", async () => {
      await store.append("sess1", [msg]);
      await store.append("sess1", [{ ...msg, content: "World" }]);
      const messages = await store.getMessages("sess1");
      expect(messages).toHaveLength(2);
    });

    it("deletes a session", async () => {
      await store.append("sess1", [msg]);
      await store.deleteSession("sess1");
      const messages = await store.getMessages("sess1");
      expect(messages).toEqual([]);
    });
  });

  // ═══ ContextStore ═══

  describe("ContextStore", () => {
    const entry: ContextEntry = {
      contextId: "ctx1",
      agentId: "agent1",
      invocationId: "inv1",
      content: "Some context",
      createdAt: "2026-01-01T00:00:00Z",
    };

    it("adds and retrieves context", async () => {
      await store.addContext("ctx1", entry);
      const entries = await store.getContext("ctx1");
      expect(entries).toHaveLength(1);
      expect(entries[0].content).toBe("Some context");
    });

    it("returns empty array for unknown context", async () => {
      const entries = await store.getContext("nonexistent");
      expect(entries).toEqual([]);
    });

    it("clears context", async () => {
      await store.addContext("ctx1", entry);
      await store.clearContext("ctx1");
      const entries = await store.getContext("ctx1");
      expect(entries).toEqual([]);
    });
  });

  // ═══ LogStore ═══

  describe("LogStore", () => {
    const logEntry: InvocationLog = {
      id: "inv_001",
      agentId: "agent1",
      input: "test input",
      output: "test output",
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      duration: 100,
      model: "openai/gpt-4o",
      timestamp: "2026-01-01T00:00:00Z",
    };

    it("logs and retrieves entries", async () => {
      await store.log(logEntry);
      const logs = await store.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].id).toBe("inv_001");
    });

    it("gets a specific log", async () => {
      await store.log(logEntry);
      const log = await store.getLog("inv_001");
      expect(log).toBeDefined();
      expect(log!.agentId).toBe("agent1");
    });

    it("returns null for unknown log", async () => {
      const log = await store.getLog("nonexistent");
      expect(log).toBeNull();
    });

    it("filters by agentId", async () => {
      await store.log(logEntry);
      await store.log({ ...logEntry, id: "inv_002", agentId: "agent2" });
      const logs = await store.getLogs({ agentId: "agent1" });
      expect(logs).toHaveLength(1);
      expect(logs[0].agentId).toBe("agent1");
    });

    it("limits results", async () => {
      await store.log(logEntry);
      await store.log({ ...logEntry, id: "inv_002" });
      await store.log({ ...logEntry, id: "inv_003" });
      const logs = await store.getLogs({ limit: 2 });
      expect(logs).toHaveLength(2);
    });
  });
});
