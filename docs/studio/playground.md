# Playground

The Playground lets you test any agent interactively with full control over sessions, context, and runtime data.

## Features

- **Agent Selection** — Choose which agent to invoke
- **Session ID** — Set a session for conversational continuity
- **Context IDs** — Specify context buckets to inject
- **Runtime Context (toolContext)** — JSON editor for runtime data passed to tools
- **Presets** — Save common toolContext configurations
- **Response Inspector** — View output, tool calls, token usage, and duration

## Testing with Runtime Context

The toolContext panel lets you pass runtime data that tools access via `ctx`:

```json
{
  "user": {
    "id": "1",
    "name": "Aaron",
    "plan": "pro"
  }
}
```

This is essential for testing tool-driven agent chains where tools need runtime data to construct dynamic context paths.
