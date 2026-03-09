#!/usr/bin/env node

/**
 * agent-runner CLI
 *
 * Commands:
 *   init     — Scaffold a new agent-runner project
 *   invoke   — Invoke an agent from the command line
 *   studio   — Launch the Studio UI (requires @agent-runner/studio)
 */

import { parseArgs } from "node:util";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const HELP = `
agent-runner — TypeScript SDK for AI agents

Usage:
  agent-runner <command> [options]

Commands:
  init              Scaffold a new agent-runner project
  invoke <agentId>  Invoke an agent (requires agent-runner.config.ts)
  eval <agentId>    Run eval suite for an agent
  studio            Launch the Studio UI

Options:
  -h, --help        Show help
  -v, --version     Show version

Eval Options:
  --json            Output results as JSON (one line per agent)
  --all             Run evals for all agents with eval configs
  --threshold <n>   Override pass threshold (0-1)

Examples:
  agent-runner init
  agent-runner invoke greeter "Hello!"
  agent-runner eval support --json
  agent-runner eval --all --threshold 0.8
  agent-runner studio
`.trim();

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    const pkg = await import("../package.json", { with: { type: "json" } }).catch(() => ({
      default: { version: "unknown" },
    }));
    console.log(`agent-runner v${pkg.default.version}`);
    process.exit(0);
  }

  const command = args[0];

  switch (command) {
    case "init":
      await cmdInit();
      break;
    case "invoke":
      await cmdInvoke(args.slice(1));
      break;
    case "eval":
      await cmdEval(args.slice(1));
      break;
    case "studio":
      await cmdStudio();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log(HELP);
      process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════
// init — scaffold a new project
// ═══════════════════════════════════════════════════════════════════

async function cmdInit() {
  const cwd = process.cwd();

  // Check if already initialized
  if (existsSync(join(cwd, "agent-runner.config.ts"))) {
    console.log("⚠️  agent-runner.config.ts already exists. Skipping.");
    process.exit(0);
  }

  // Create config file
  const configContent = `import { createRunner, defineAgent } from "agent-runner";

// Create your runner
const runner = createRunner({
  defaults: {
    model: { provider: "openai", name: "gpt-4o-mini" },
  },
});

// Define your first agent
runner.registerAgent(defineAgent({
  id: "greeter",
  name: "Greeter",
  systemPrompt: "You are a friendly greeter. Keep responses under 2 sentences.",
  model: { provider: "openai", name: "gpt-4o-mini" },
}));

export default runner;
`;

  await writeFile(join(cwd, "agent-runner.config.ts"), configContent);
  console.log("✅ Created agent-runner.config.ts");

  // Create data directory
  await mkdir(join(cwd, "data"), { recursive: true });
  console.log("✅ Created data/ directory");

  // Create agents directory with a sample
  await mkdir(join(cwd, "data", "agents"), { recursive: true });

  const sampleAgent = {
    id: "greeter",
    name: "Greeter",
    systemPrompt: "You are a friendly greeter. Keep responses under 2 sentences.",
    model: { provider: "openai", name: "gpt-4o-mini" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await writeFile(
    join(cwd, "data", "agents", "greeter.json"),
    JSON.stringify(sampleAgent, null, 2)
  );
  console.log("✅ Created data/agents/greeter.json");

  console.log(`
🚀 agent-runner initialized!

Next steps:
  1. Set your API key:  export OPENAI_API_KEY=sk-...
  2. Edit agent-runner.config.ts to customize your agents
  3. Invoke:  npx agent-runner invoke greeter "Hello!"
`);
}

// ═══════════════════════════════════════════════════════════════════
// invoke — run an agent from CLI
// ═══════════════════════════════════════════════════════════════════

async function cmdInvoke(args: string[]) {
  if (args.length < 2) {
    console.error('Usage: agent-runner invoke <agentId> "<input>"');
    process.exit(1);
  }

  const agentId = args[0];
  const input = args.slice(1).join(" ");

  // Load the runner config
  const configPath = resolve(process.cwd(), "agent-runner.config.ts");
  if (!existsSync(configPath)) {
    console.error("❌ No agent-runner.config.ts found. Run `agent-runner init` first.");
    process.exit(1);
  }

  try {
    // Dynamic import of the config (requires tsx or similar for .ts files)
    const config = await import(configPath);
    const runner = config.default;

    if (!runner?.invoke) {
      console.error("❌ agent-runner.config.ts must export a Runner as default.");
      process.exit(1);
    }

    console.log(`⏳ Invoking agent "${agentId}"...\n`);

    const result = await runner.invoke(agentId, input);

    console.log(result.output);
    console.log(`\n---`);
    console.log(`Model: ${result.model}`);
    console.log(`Tokens: ${result.usage.totalTokens} (${result.usage.promptTokens}↑ ${result.usage.completionTokens}↓)`);
    console.log(`Duration: ${result.duration}ms`);

    if (result.toolCalls.length > 0) {
      console.log(`Tool calls: ${result.toolCalls.length}`);
      for (const tc of result.toolCalls) {
        console.log(`  • ${tc.name} (${tc.duration}ms)`);
      }
    }
  } catch (error) {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════
// eval — run eval suite
// ═══════════════════════════════════════════════════════════════════

async function cmdEval(args: string[]) {
  // Parse flags
  const jsonMode = args.includes("--json");
  const allMode = args.includes("--all");
  const filteredArgs = args.filter((a) => a !== "--json" && a !== "--all");

  // Parse --threshold <value>
  let thresholdOverride: number | undefined;
  const thresholdIdx = filteredArgs.indexOf("--threshold");
  if (thresholdIdx !== -1) {
    thresholdOverride = parseFloat(filteredArgs[thresholdIdx + 1]);
    filteredArgs.splice(thresholdIdx, 2);
  }

  const agentId = filteredArgs[0];

  if (!agentId && !allMode) {
    console.error("Usage: agent-runner eval <agentId> [--json] [--threshold <0-1>] [--all]");
    process.exit(1);
  }

  const configPath = resolve(process.cwd(), "agent-runner.config.ts");
  if (!existsSync(configPath)) {
    console.error("❌ No agent-runner.config.ts found. Run `agent-runner init` first.");
    process.exit(1);
  }

  try {
    const config = await import(configPath);
    const runner = config.default;

    if (!runner?.eval) {
      console.error("❌ agent-runner.config.ts must export a Runner as default.");
      process.exit(1);
    }

    // Determine which agents to eval
    let agentIds: string[];
    if (allMode) {
      // Get all agents that have eval configs
      const agents = await runner.listAgents?.() ?? [];
      agentIds = agents
        .filter((a: any) => a.eval?.testCases?.length > 0)
        .map((a: any) => a.id);
      if (agentIds.length === 0) {
        console.error("❌ No agents with eval configs found.");
        process.exit(1);
      }
    } else {
      agentIds = [agentId];
    }

    let totalFailed = 0;
    const allResults: any[] = [];

    for (const id of agentIds) {
      if (!jsonMode) {
        console.log(`🧪 Running evals for "${id}"...\n`);
      }

      const result = await runner.eval(id, {
        onProgress: !jsonMode
          ? (completed: number, total: number, name: string) => {
              if (name !== "done") {
                console.log(`  [${completed + 1}/${total}] ${name}...`);
              }
            }
          : undefined,
      });

      // Apply threshold override
      if (thresholdOverride !== undefined) {
        for (const tc of result.testCases) {
          tc.passed = tc.score >= thresholdOverride;
        }
        result.summary.passed = result.testCases.filter((tc: any) => tc.passed).length;
        result.summary.failed = result.summary.total - result.summary.passed;
        result.summary.score =
          result.testCases.reduce((sum: number, tc: any) => sum + tc.score, 0) /
          result.summary.total;
      }

      allResults.push({ agentId: id, ...result });
      totalFailed += result.summary.failed;

      if (jsonMode) {
        // JSON output — one line per agent
        console.log(JSON.stringify({ agentId: id, ...result }));
      } else {
        // Human-readable output
        console.log("");
        for (const tc of result.testCases) {
          const icon = tc.passed ? "✅" : "❌";
          console.log(`${icon} ${tc.name} (score: ${(tc.score * 100).toFixed(0)}%)`);
          for (const a of tc.assertions) {
            const aIcon = a.passed ? "  ✓" : "  ✗";
            console.log(`${aIcon} [${a.type}] ${a.reason ?? ""}`);
          }
        }

        console.log(`\n─── Summary ───`);
        console.log(`Total:    ${result.summary.total}`);
        console.log(`Passed:   ${result.summary.passed}`);
        console.log(`Failed:   ${result.summary.failed}`);
        console.log(`Score:    ${(result.summary.score * 100).toFixed(1)}%`);
        console.log(`Duration: ${result.duration}ms`);

        if (agentIds.length > 1) {
          console.log("");
        }
      }
    }

    if (totalFailed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════
// studio — launch the Studio UI
// ═══════════════════════════════════════════════════════════════════

async function cmdStudio() {
  const configPath = resolve(process.cwd(), "agent-runner.config.ts");

  // Try to load the runner from config
  let runner: any;
  try {
    if (existsSync(configPath)) {
      const config = await import(configPath);
      runner = config.default;
    }
  } catch {
    // Config load failed — will create a default runner
  }

  if (!runner) {
    // Create a minimal runner with the default stores
    const { createRunner } = await import("./runner.js");
    runner = createRunner({
      defaults: { model: { provider: "openai", name: "gpt-4o-mini" } },
    });
    console.log("⚠️  No agent-runner.config.ts found. Using default runner.\n");
  }

  // Try to import the studio package
  try {
    const studioModule = await import(/* @vite-ignore */ "@agent-runner/studio" as string)
      .catch(() => null);
    if (!studioModule) throw new Error("Cannot find @agent-runner/studio");
    const { createStudio } = studioModule;
    const port = parseInt(process.env.PORT || "4000", 10);

    await createStudio(runner, {
      port,
      onReady: (url: string) => {
        console.log(`\n  ⚡ agent-runner Studio`);
        console.log(`  ➜ ${url}\n`);
      },
    });
  } catch (err) {
    if (String(err).includes("Cannot find")) {
      console.error("❌ @agent-runner/studio is not installed.");
      console.error("   Install it: pnpm add -D @agent-runner/studio");
    } else {
      console.error(`❌ Failed to start Studio: ${err instanceof Error ? err.message : String(err)}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
