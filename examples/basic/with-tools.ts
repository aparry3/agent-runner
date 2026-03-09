/**
 * agent-runner — Tools Example
 *
 * Shows how to define inline tools and use them with an agent.
 *
 * Usage:
 *   Set OPENAI_API_KEY in your environment, then:
 *   npx tsx examples/basic/with-tools.ts
 */

import { createRunner, defineAgent, defineTool } from "agent-runner";
import { z } from "zod";

// Define a tool
const getWeather = defineTool({
  name: "get_weather",
  description: "Get the current weather for a city",
  input: z.object({
    city: z.string().describe("The city name"),
  }),
  async execute(input) {
    // In a real app, this would call a weather API
    const weather: Record<string, string> = {
      "new york": "72°F, sunny",
      "london": "58°F, cloudy",
      "tokyo": "68°F, partly cloudy",
    };
    return {
      city: input.city,
      weather: weather[input.city.toLowerCase()] ?? "Weather data not available",
    };
  },
});

// Create runner with the tool
const runner = createRunner({ tools: [getWeather] });

// Define an agent that uses the tool
runner.registerAgent(
  defineAgent({
    id: "weather-bot",
    name: "Weather Bot",
    systemPrompt:
      "You are a helpful weather assistant. Use the get_weather tool to check weather for cities users ask about.",
    model: { provider: "openai", name: "gpt-4o" },
    tools: [{ type: "inline", name: "get_weather" }],
  })
);

// Invoke
const result = await runner.invoke("weather-bot", "What's the weather like in Tokyo?");

console.log(result.output);
console.log(`\n📊 ${result.usage.totalTokens} tokens | ${result.duration}ms`);
console.log(`🔧 Tool calls: ${result.toolCalls.length}`);
for (const tc of result.toolCalls) {
  console.log(`   • ${tc.name}(${JSON.stringify(tc.input)}) → ${JSON.stringify(tc.output)}`);
}
