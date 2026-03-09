/**
 * agent-runner — MCP Integration Example
 *
 * Demonstrates how to connect agents to MCP (Model Context Protocol) servers
 * for tool integration. MCP servers provide tools that agents can use — like
 * filesystem access, GitHub operations, database queries, etc.
 *
 * This example shows:
 * - Connecting to MCP servers (stdio and HTTP transports)
 * - Assigning MCP tools to agents
 * - Selective tool exposure (pick specific tools from a server)
 *
 * Usage:
 *   Set ANTHROPIC_API_KEY in your environment, then:
 *   npx tsx examples/with-mcp/index.ts
 *
 * Prerequisites:
 *   This example expects an MCP filesystem server. Install with:
 *   npm install -g @anthropic/mcp-fs
 */

import { createRunner, defineAgent } from "agent-runner";

// 1. Create a runner with MCP servers configured
const runner = createRunner({
  mcp: {
    servers: {
      // stdio transport — spawns a local process
      filesystem: {
        command: "npx",
        args: ["-y", "@anthropic/mcp-fs", "--root", process.cwd()],
      },
      // HTTP/SSE transport — connects to a running server
      // Uncomment if you have an MCP server running:
      // github: {
      //   url: "http://localhost:3001/mcp",
      //   headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
      // },
    },
  },
});

// 2. Define an agent that uses MCP tools
runner.registerAgent(
  defineAgent({
    id: "file-assistant",
    name: "File Assistant",
    systemPrompt: `You are a helpful file assistant. You can read, list, and search files
in the current directory using the filesystem tools available to you.
Be concise in your responses and format file listings clearly.`,
    model: { provider: "anthropic", name: "claude-sonnet-4-20250514" },
    tools: [
      // Use ALL tools from the filesystem server
      { type: "mcp", server: "filesystem" },
    ],
  })
);

// 3. Define another agent with selective tool exposure
runner.registerAgent(
  defineAgent({
    id: "code-reader",
    name: "Code Reader",
    systemPrompt: `You are a code analysis assistant. You can only READ files — 
you cannot create, modify, or delete anything. Analyze code structure,
explain what files do, and answer questions about the codebase.`,
    model: { provider: "anthropic", name: "claude-sonnet-4-20250514" },
    tools: [
      // Only expose specific read-only tools from the server
      {
        type: "mcp",
        server: "filesystem",
        tools: ["read_file", "list_directory", "search_files"],
      },
    ],
  })
);

// 4. List discovered tools
const tools = runner.tools.list();
console.log("🔧 Discovered tools:");
for (const tool of tools) {
  console.log(`  ${tool.source} → ${tool.name}: ${tool.description}`);
}

// 5. Invoke the file assistant
console.log("\n📁 Asking file-assistant to list files...\n");
const result = await runner.invoke(
  "file-assistant",
  "List the files in the current directory and tell me what this project is about."
);

console.log(result.output);
console.log(
  `\n📊 ${result.toolCalls.length} tool calls | ${result.usage.totalTokens} tokens | ${result.duration}ms`
);

// 6. Clean up MCP connections
await runner.shutdown();
