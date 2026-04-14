import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PostgresStore } from "../src/postgres-store.js";
import type { AgentDefinition } from "@agent-runner/core";

/**
 * Integration tests for PostgresStore. Runs against a real Postgres instance
 * when DATABASE_URL is set; skipped otherwise (CI should provide a test DB).
 *
 * We dropped the previous mock-pool tests after the multi-tenancy migration —
 * the mock diverged significantly from real Postgres behavior (WHERE clauses,
 * composite PKs, cascades) and was more liability than value. SQLite and
 * MemoryStore tests cover the contract; this file verifies the Postgres-
 * specific SQL actually works.
 */
const url = process.env.DATABASE_URL;
const hasDb = !!url;

describe.skipIf(!hasDb)("PostgresStore (integration)", () => {
  let admin: PostgresStore;
  let workspaceId: string;

  beforeAll(async () => {
    admin = new PostgresStore({ connection: url!, tablePrefix: `art_${Date.now()}_` });
    const ws = await admin.createWorkspace({ clerkOrgId: `org_${Date.now()}`, name: "Test" });
    workspaceId = ws.id;
  });

  afterAll(async () => {
    await admin.close();
  });

  it("scopes agents to the workspace", async () => {
    const store = admin.forWorkspace(workspaceId);
    const agent: AgentDefinition = {
      id: "test",
      name: "Test",
      systemPrompt: "",
      model: { provider: "openai", name: "gpt-4o" },
    };
    await store.putAgent(agent);
    const retrieved = await store.getAgent("test");
    expect(retrieved?.name).toBe("Test");

    const wsB = await admin.createWorkspace({ clerkOrgId: `org_b_${Date.now()}`, name: "B" });
    const storeB = admin.forWorkspace(wsB.id);
    expect(await storeB.getAgent("test")).toBeNull();
  });

  it("creates, resolves, and revokes API keys", async () => {
    const { record, rawKey } = await admin.createApiKey({ workspaceId, name: "k" });
    expect(rawKey).toMatch(/^ar_live_/);

    const resolved = await admin.resolveApiKey(rawKey);
    expect(resolved).toEqual({ workspaceId, keyId: record.id });

    await admin.revokeApiKey({ workspaceId, keyId: record.id });
    expect(await admin.resolveApiKey(rawKey)).toBeNull();
  });

  it("throws on scoped methods when unscoped", async () => {
    await expect(admin.getAgent("x")).rejects.toThrow(/workspace not set/);
  });
});
