# defineAgent()

Creates a validated agent definition.

## Signature

```typescript
function defineAgent(config: AgentDefinitionInput): AgentDefinition
```

## Parameters

See [Agents Guide](/guide/agents) for full schema documentation.

```typescript
defineAgent({
  id: "support",
  name: "Support Agent",
  systemPrompt: "You are a helpful support agent...",
  model: { provider: "openai", name: "gpt-4o" },
  // All other fields are optional
});
```

## Validation

`defineAgent()` validates the input with Zod and throws if invalid:

- `id` must be a non-empty string
- `name` must be a non-empty string
- `systemPrompt` must be a non-empty string
- `model.provider` and `model.name` are required
- `model.temperature` must be between 0 and 2
- Tool references must have valid types
