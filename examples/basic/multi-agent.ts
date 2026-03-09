/**
 * agent-runner — Multi-Agent Example
 *
 * Shows agent-as-tool: one agent can invoke another as a tool.
 * The writer delegates research to the researcher automatically.
 *
 * Usage:
 *   Set OPENAI_API_KEY in your environment, then:
 *   npx tsx examples/basic/multi-agent.ts
 */

import { createRunner, defineAgent } from "agent-runner";

const runner = createRunner();

// The researcher gathers information
runner.registerAgent(
  defineAgent({
    id: "researcher",
    name: "Researcher",
    description: "Researches topics and returns concise findings",
    systemPrompt:
      "You are a thorough researcher. When given a topic, provide key facts, statistics, and insights in a concise format. Focus on accuracy and relevance.",
    model: { provider: "openai", name: "gpt-4o" },
  })
);

// The writer creates content, using the researcher for facts
runner.registerAgent(
  defineAgent({
    id: "writer",
    name: "Writer",
    systemPrompt:
      "You are a skilled technical writer. When asked to write about a topic, first use the researcher to gather facts, then craft a well-structured article. Keep it concise but informative.",
    model: { provider: "openai", name: "gpt-4o" },
    tools: [
      { type: "agent", agentId: "researcher" }, // Writer can invoke researcher as a tool
    ],
  })
);

// Invoke the writer — it will automatically call the researcher
const result = await runner.invoke("writer", "Write a short article about WebAssembly");

console.log(result.output);
console.log(`\n📊 ${result.usage.totalTokens} tokens | ${result.duration}ms`);
console.log(`🔧 Tool calls: ${result.toolCalls.length}`);
for (const tc of result.toolCalls) {
  console.log(`   • ${tc.name}: "${String(tc.input).slice(0, 60)}..."`);
}
