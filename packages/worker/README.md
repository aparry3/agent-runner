# @agent-runner/worker

Hono HTTP worker that executes YAML-defined agents via the manifest engine. Workspace-aware (multi-tenant) — every request resolves to a `workspace_id` before hitting the store.

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | none | Liveness probe |
| `POST` | `/run` | required | Execute an agent, return final output + state |
| `POST` | `/run/stream` | required | Same, as Server-Sent Events |

### Request shape

```json
{
  "workspaceId": "uuid",   // only required when using X-Internal-Secret auth
  "agentId": "agent-builder",
  "input": { "description": "..." }
}
```

## Authentication

Two modes are accepted by the `workerAuth` middleware in `src/middleware/auth.ts`:

### Internal (app → worker)

```
X-Internal-Secret: $WORKER_INTERNAL_SECRET
```

The worker trusts the header and reads `workspaceId` from the request body. This is what `@agent-runner/app` uses when proxying a signed-in user's request.

### External (service → worker)

```
Authorization: Bearer ar_live_<token>
```

Keys are created in the app's **Settings → API Keys** UI (they're sha256-hashed in `ar_api_keys`). The worker calls `store.resolveApiKey(rawKey)` to map the token to its workspace.

Any request without one of these is rejected with 401.

## Env vars

```bash
PORT=4001
HOSTNAME=0.0.0.0
WORKER_INTERNAL_SECRET=...        # required
STORE=postgres                    # or memory (dev only)
DATABASE_URL=postgres://...       # when STORE=postgres
DEFAULT_MODEL_PROVIDER=openai
DEFAULT_MODEL_NAME=gpt-4o
BUILT_IN_AGENTS_DIR=...           # optional: extra YAMLs to seed per workspace
```

## Built-in agent seeding

Default agents shipped in `src/defaults/agents/` (currently `agent-builder.yaml`) are seeded into every workspace lazily on its first `/run` request, via `seedDefaultsForWorkspace()`. Idempotent: tracks seeded workspaces in-process and double-checks the store before inserting.

## Run locally

```bash
pnpm --filter @agent-runner/worker dev
```
