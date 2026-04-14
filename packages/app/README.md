# @agent-runner/app

Hosted web UI for agent-runner. Next.js 15 App Router + Tailwind + Clerk auth + per-workspace multi-tenancy. Pairs with `@agent-runner/worker` for agent execution.

## Features

- **Agent editor** — YAML manifest editor with live validation + AI-assisted build-from-description
- **Playground** — per-agent interactive runner with SSE streaming
- **Sessions & logs** — browse conversation history and invocation traces
- **Tool catalog** — list available inline / MCP tools
- **Providers** — per-workspace LLM API key management
- **API keys** — per-workspace programmatic auth for external apps
- **Auth** — Clerk sign-in / sign-up / Organizations
- **Multi-tenancy** — each Clerk organization is an isolated workspace

## Architecture

```
 Browser ──(Clerk session)──► app (Next.js, :3000) ──(X-Internal-Secret + workspaceId)──► worker (Hono, :4001)
 External caller ──(Bearer ar_live_...)────────────────────────────────────────────────► worker
                                                             │
                                                             ▼
                                                   Postgres (ar_* tables, workspace_id scoped)
```

The app serves browser requests, resolves the user's active Clerk organization → workspace, and either handles the CRUD itself (store reads/writes) or proxies to the worker for `/run` and `/run/stream`. The worker can also be called directly by external services using an `ar_live_...` API key created in **Settings → API Keys**.

## Local setup

### 1. Clerk dev app

Sign up at https://clerk.com → create app → **Organizations → enable** and allow users to create organizations.

From the API Keys page copy `Publishable key` + `Secret key`.

### 2. Postgres

```bash
docker run -d --name ar-pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
```

### 3. `.env.local` at repo root

See `.env.example`. Minimum:

```bash
STORE=postgres
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

WORKER_URL=http://localhost:4001
WORKER_INTERNAL_SECRET=$(openssl rand -base64 32)

OPENAI_API_KEY=sk-...   # or any provider you use
```

Optional: `CLERK_WEBHOOK_SIGNING_SECRET` — only needed if you register the webhook in Clerk. The app's lazy-create fallback handles unseen orgs on first request.

### 4. Run

```bash
pnpm --filter @agent-runner/worker dev    # :4001
pnpm --filter @agent-runner/app dev       # :3000
```

Sign up at http://localhost:3000 → onboarding creates your first workspace → create an agent.

## How scoping works

Every API route calls `requireWorkspaceContext()` from `@/lib/workspace`, which:

1. Reads `{ userId, orgId }` from Clerk's session
2. Looks up (or lazy-creates) the corresponding `ar_workspaces` row
3. Returns a workspace-scoped `UnifiedStore` via `adminStore.forWorkspace(ws.id)` plus a fresh `Runner` wired to it

The worker's `workerAuth` middleware accepts two authentication modes:

- **Internal** — `X-Internal-Secret: $WORKER_INTERNAL_SECRET` header + `workspaceId` in the JSON body. Used by the app when calling `/run` on behalf of the signed-in user.
- **External** — `Authorization: Bearer ar_live_...` header. The key is sha256'd and resolved to a `workspace_id`.

In both cases the worker constructs a scoped runner: `store.forWorkspace(workspaceId)` + `createRunner({ store })`.

## Deployment

Planned: Vercel (app) + Railway (worker) + Neon (Postgres) on `agntz.co`. See the repo's planning docs for the current deploy plan.

## Related packages

| Package | Description |
|---|---|
| [`@agent-runner/core`](../core) | The underlying SDK |
| [`@agent-runner/worker`](../worker) | Hono HTTP worker consumed by this app |
| [`@agent-runner/store-postgres`](../store-postgres) | Production store used in deployment |
