# Studio Overview

The agent-runner Studio is a built-in development UI for defining, testing, and debugging agents. Like Prisma Studio for databases, it provides a visual interface to the same data your code uses.

## Launching

```bash
# CLI (recommended)
npx agent-runner studio

# Programmatic
import { createStudio } from "@agent-runner/studio";
const studio = createStudio(runner);
studio.listen(4000);

# Express/Hono middleware
import { studioMiddleware } from "@agent-runner/studio/middleware";
app.use("/studio", studioMiddleware(runner));
```

## Pages

| Page | Purpose |
|------|---------|
| **Agent Editor** | Create/edit agent definitions (system prompt, model, tools, examples) |
| **Tool Catalog** | Browse all registered tools, view schemas, test execution |
| **MCP Servers** | Add/remove MCP servers, view connection status |
| **Playground** | Invoke any agent with session/context controls |
| **Evals** | Run eval suites, view results dashboard |
| **Context Browser** | Browse context IDs, inspect content, create/edit manually |
| **Sessions** | Browse session history |
| **Logs** | Filterable invocation log with full inspection |

## Key Principle

The Studio reads from the **same stores** as your code. There's no separate database, no sync issues:

- Agent created in Studio → immediately available to `runner.invoke()`
- Tool registered in code → immediately visible in Studio
- Eval run in Studio → same results as `runner.eval()`

## REST API

The Studio exposes a REST API that the UI consumes:

```
GET    /api/agents              List agents
PUT    /api/agents/:id          Create/update agent
POST   /api/agents/:id/invoke   Invoke agent
GET    /api/tools               List all tools
GET    /api/sessions            List sessions
GET    /api/context             List context IDs
GET    /api/logs                List invocation logs
POST   /api/evals/:id/run       Run eval suite
```

All endpoints follow standard REST conventions with JSON request/response bodies.
