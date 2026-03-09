/**
 * agent-runner — Basic Example
 *
 * Demonstrates the simplest possible agent: 5 lines to hello world.
 *
 * Usage:
 *   Set OPENAI_API_KEY in your environment, then:
 *   npx tsx examples/basic/index.ts
 */

import { createRunner, defineAgent } from "agent-runner";

// 1. Create a runner (defaults to in-memory store)
const runner = createRunner();

// 2. Define an agent
runner.registerAgent(
  defineAgent({
    id: "greeter",
    name: "Greeter",
    systemPrompt: "You are a friendly greeter. Keep responses under 2 sentences.",
    model: { provider: "openai", name: "gpt-4o-mini" },
  })
);

// 3. Invoke it
const result = await runner.invoke("greeter", "Hello! I'm building my first AI agent.");

// 4. See the result
console.log(result.output);
console.log(`\n📊 ${result.usage.totalTokens} tokens | ${result.duration}ms | ${result.model}`);
