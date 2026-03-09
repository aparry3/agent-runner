/**
 * agent-runner — Studio Example
 *
 * Demonstrates launching the built-in Studio UI for visual agent development.
 * The Studio provides:
 * - Agent Editor — create/edit agents in a UI
 * - Tool Catalog — browse and test all registered tools
 * - Playground — invoke agents interactively
 * - Evals Dashboard — run and view test results
 * - Context Browser — inspect shared context
 * - Sessions & Logs — full invocation history
 *
 * Usage:
 *   Set OPENAI_API_KEY in your environment, then:
 *   npx tsx examples/with-studio/index.ts
 *
 *   Then open http://localhost:4200 in your browser.
 */

import { createRunner, defineAgent, defineTool } from "agent-runner";
import { createStudio } from "@agent-runner/studio";
import { JsonFileStore } from "agent-runner/stores";
import { z } from "zod";

// 1. Define some tools
const getWeather = defineTool({
  name: "get_weather",
  description: "Get current weather for a location",
  input: z.object({
    location: z.string().describe("City name or coordinates"),
  }),
  async execute(input) {
    // Mock implementation — replace with a real weather API
    return {
      location: input.location,
      temperature: 72,
      condition: "Partly cloudy",
      humidity: 45,
    };
  },
});

const searchKnowledge = defineTool({
  name: "search_knowledge",
  description: "Search the knowledge base for relevant information",
  input: z.object({
    query: z.string().describe("Search query"),
    limit: z.number().optional().describe("Max results (default: 5)"),
  }),
  async execute(input) {
    // Mock implementation — replace with a real search
    return {
      results: [
        { title: "Getting Started", snippet: "Welcome to the knowledge base..." },
        { title: "FAQ", snippet: "Frequently asked questions..." },
      ],
      total: 2,
    };
  },
});

// 2. Create a runner with persistent storage and tools
const runner = createRunner({
  store: new JsonFileStore("./data"),
  tools: [getWeather, searchKnowledge],
});

// 3. Register agents
runner.registerAgent(
  defineAgent({
    id: "assistant",
    name: "General Assistant",
    description: "A helpful assistant with weather and knowledge tools",
    systemPrompt: `You are a helpful assistant. Use your tools when relevant:
- get_weather: for weather questions
- search_knowledge: for factual questions

Be concise and friendly.`,
    model: { provider: "openai", name: "gpt-4o-mini" },
    tools: [
      { type: "inline", name: "get_weather" },
      { type: "inline", name: "search_knowledge" },
    ],
    eval: {
      testCases: [
        {
          name: "uses weather tool",
          input: "What's the weather in NYC?",
          assertions: [
            { type: "contains", value: "72" },
            { type: "contains", value: "cloud" },
          ],
        },
        {
          name: "friendly greeting",
          input: "Hello!",
          assertions: [
            { type: "llm-rubric", value: "Response is friendly and welcoming" },
          ],
        },
      ],
    },
  })
);

runner.registerAgent(
  defineAgent({
    id: "researcher",
    name: "Researcher",
    description: "Researches topics using the knowledge base",
    systemPrompt: "You are a researcher. Search the knowledge base to answer questions thoroughly.",
    model: { provider: "openai", name: "gpt-4o" },
    tools: [{ type: "inline", name: "search_knowledge" }],
    contextWrite: true, // Output auto-writes to shared context
  })
);

// 4. Launch the Studio
const studio = createStudio(runner);
const port = 4200;

studio.listen(port, () => {
  console.log(`\n🎨 agent-runner Studio is running!`);
  console.log(`   Open http://localhost:${port} in your browser\n`);
  console.log(`   Features:`);
  console.log(`   • Agent Editor — edit "assistant" and "researcher"`);
  console.log(`   • Tool Catalog — browse get_weather, search_knowledge`);
  console.log(`   • Playground — test agents interactively`);
  console.log(`   • Evals — run the assistant's test suite`);
  console.log(`   • Context Browser — see what researchers write`);
  console.log(`   • Sessions & Logs — full history\n`);
});
