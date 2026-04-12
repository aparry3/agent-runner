import type { UnifiedStore } from "@agent-runner/core";

let _store: UnifiedStore | null = null;

/**
 * Get the store instance. Lazily initialized from environment config.
 * Supports: postgres, sqlite, memory (default).
 */
export async function getStore(): Promise<UnifiedStore> {
  if (_store) return _store;

  const storeType = process.env.STORE ?? "memory";

  switch (storeType) {
    case "postgres": {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error("DATABASE_URL is required when STORE=postgres");
      }
      // @ts-expect-error -- optional dependency, installed when STORE=postgres
      const { PostgresStore } = await import("@agent-runner/store-postgres");
      _store = new PostgresStore(connectionString);
      break;
    }
    case "sqlite": {
      const path = process.env.SQLITE_PATH ?? "./data/agent-runner.db";
      // @ts-expect-error -- optional dependency, installed when STORE=sqlite
      const { SqliteStore } = await import("@agent-runner/store-sqlite");
      _store = new SqliteStore(path);
      break;
    }
    case "memory":
    default: {
      const { MemoryStore } = await import("@agent-runner/core");
      _store = new MemoryStore();
      break;
    }
  }

  return _store!;
}
