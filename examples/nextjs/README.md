# agent-runner + Next.js Example

This example shows how to integrate agent-runner into a Next.js application with:

- API route for agent invocation
- Embedded Studio UI in development
- Streaming responses to the frontend

## Setup

```bash
# Create a Next.js app
npx create-next-app@latest my-agent-app
cd my-agent-app

# Install agent-runner
npm install agent-runner @agent-runner/studio
```

## Project Structure

```
my-agent-app/
├── lib/
│   └── runner.ts          # Shared runner instance
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts   # Chat API endpoint
│   │   └── studio/
│   │       └── [...path]/
│   │           └── route.ts  # Studio API proxy
│   └── page.tsx            # Chat UI
└── data/                   # JSON file store
```

## Files

### `lib/runner.ts` — Shared Runner Instance

```typescript
import { createRunner, defineAgent, defineTool } from "agent-runner";
import { JsonFileStore } from "agent-runner/stores";
import { z } from "zod";

// Singleton runner — shared across API routes
let runner: ReturnType<typeof createRunner> | null = null;

export function getRunner() {
  if (runner) return runner;

  runner = createRunner({
    store: new JsonFileStore("./data"),
    tools: [
      defineTool({
        name: "get_time",
        description: "Get the current date and time",
        input: z.object({}),
        async execute() {
          return { time: new Date().toISOString() };
        },
      }),
    ],
  });

  runner.registerAgent(
    defineAgent({
      id: "assistant",
      name: "Assistant",
      systemPrompt: "You are a helpful assistant. Be concise and friendly.",
      model: { provider: "openai", name: "gpt-4o-mini" },
      tools: [{ type: "inline", name: "get_time" }],
    })
  );

  return runner;
}
```

### `app/api/chat/route.ts` — Chat Endpoint

```typescript
import { getRunner } from "@/lib/runner";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { message, sessionId } = await req.json();
  const runner = getRunner();

  const result = await runner.invoke("assistant", message, {
    sessionId: sessionId || undefined,
  });

  return NextResponse.json({
    output: result.output,
    sessionId: sessionId,
    usage: result.usage,
    duration: result.duration,
  });
}
```

### `app/api/chat/stream/route.ts` — Streaming Endpoint

```typescript
import { getRunner } from "@/lib/runner";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { message, sessionId } = await req.json();
  const runner = getRunner();

  const stream = await runner.invoke("assistant", message, {
    sessionId: sessionId || undefined,
    stream: true,
  });

  // Return as a ReadableStream
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

### Embedding Studio in Development

```typescript
// app/api/studio/[...path]/route.ts
import { getRunner } from "@/lib/runner";
import { studioMiddleware } from "@agent-runner/studio/middleware";

const studio = studioMiddleware(getRunner());

// Proxy all Studio API requests
export async function GET(req: Request) {
  return studio.fetch(req);
}

export async function POST(req: Request) {
  return studio.fetch(req);
}

export async function PUT(req: Request) {
  return studio.fetch(req);
}

export async function DELETE(req: Request) {
  return studio.fetch(req);
}
```

Then access the Studio at `http://localhost:3000/api/studio`.

## Environment Variables

```env
# .env.local
OPENAI_API_KEY=sk-...
# Or use another provider:
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_GENERATIVE_AI_API_KEY=...
```

## Running

```bash
npm run dev
# App:    http://localhost:3000
# Studio: http://localhost:3000/api/studio (dev only)
```
