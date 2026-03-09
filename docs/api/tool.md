# defineTool()

Creates a tool definition with Zod schema validation.

## Signature

```typescript
function defineTool<TContext = Record<string, any>>(config: ToolDefinitionInput<TContext>): ToolDefinition
```

## Parameters

```typescript
defineTool({
  name: "lookup_order",
  description: "Look up an order by ID",
  input: z.object({
    orderId: z.string().describe("The order ID"),
  }),
  async execute(input, ctx) {
    // input is validated against the Zod schema
    // ctx contains ToolContext (agentId, sessionId, invoke, + toolContext spread)
    return { order: await db.find(input.orderId) };
  },
});
```

## Type-Safe Context

```typescript
interface MyCtx {
  user: { id: string; email: string };
}

defineTool<MyCtx>({
  name: "my_tool",
  description: "A tool with typed context",
  input: z.object({}),
  async execute(input, ctx) {
    ctx.user.email; // ← typed
  },
});
```

## ToolContext

| Property | Type | Description |
|----------|------|-------------|
| `agentId` | `string` | Agent executing this tool |
| `sessionId` | `string?` | Session ID |
| `contextIds` | `string[]?` | Active context IDs |
| `invocationId` | `string` | Unique invocation ID |
| `invoke()` | `Function` | Call another agent |
| `...toolContext` | `any` | Spread from `InvokeOptions.toolContext` |
