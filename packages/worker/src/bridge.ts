import type { Runner, AgentDefinition } from "@agent-runner/core";
import type {
  ExecutionContext,
  AgentManifest,
  LLMAgentManifest,
  ToolCallConfig,
  AgentState,
} from "@agent-runner/manifest";
import { parseManifest } from "@agent-runner/manifest";

/**
 * Create an ExecutionContext that bridges the manifest engine to the core Runner.
 *
 * This is how YAML-defined agents execute: the manifest engine handles orchestration
 * (pipelines, state, conditions), and delegates actual LLM/tool calls to the Runner.
 */
export function createExecutionContext(runner: Runner): ExecutionContext {
  return {
    resolveAgent: async (id: string) => {
      const agentDef = await runner.agents.getAgent(id);
      if (!agentDef) {
        throw new Error(`Agent "${id}" not found`);
      }
      // Agent definitions stored in the DB may have a `manifest` field (YAML string)
      // or may already be a parsed manifest object stored as metadata
      const manifest = resolveManifestFromAgent(agentDef as unknown as Record<string, unknown>);
      return manifest;
    },

    invokeLLM: async (manifest: LLMAgentManifest, renderedInstruction: string, state: AgentState) => {
      // Build a temporary agent definition for the core runner
      const agentDef = manifestToAgentDefinition(manifest, renderedInstruction);

      // Register it temporarily (or use inline invoke)
      const tempId = `__temp_${manifest.id}_${Date.now()}`;
      agentDef.id = tempId;
      runner.registerAgent(agentDef as AgentDefinition);

      try {
        // Build user input from state
        const userInput = state.userQuery
          ? String(state.userQuery)
          : JSON.stringify(state);

        const result = await runner.invoke(tempId, userInput);

        // If outputSchema is defined, try to parse structured output
        if (manifest.outputSchema) {
          try {
            return JSON.parse(result.output);
          } catch {
            return result.output;
          }
        }

        return result.output;
      } finally {
        // Clean up temp agent
        await runner.agents.deleteAgent(tempId).catch(() => {});
      }
    },

    invokeTool: async (config: ToolCallConfig, state: AgentState) => {
      // Resolve the tool name (MCP tools are namespaced as "serverName:toolName")
      const toolName = config.kind === "mcp" && config.server
        ? `${config.server}:${config.name}`
        : config.name;

      // The params are already resolved from state by the tool executor
      const input = config.params ?? {};

      const result = await runner.tools.execute(toolName, input);
      return result;
    },
  };
}

/**
 * Convert a stored AgentDefinition into an AgentManifest.
 * The agent's metadata.manifest field holds the YAML source.
 */
function resolveManifestFromAgent(agentDef: Record<string, unknown>): AgentManifest {
  // If metadata contains the raw YAML manifest
  const metadata = agentDef.metadata as Record<string, unknown> | undefined;
  if (metadata?.manifest && typeof metadata.manifest === "string") {
    return parseManifest(metadata.manifest);
  }

  // If metadata contains a pre-parsed manifest object
  if (metadata?.parsedManifest) {
    return metadata.parsedManifest as AgentManifest;
  }

  // Fallback: try to construct from the agent definition itself
  throw new Error(
    `Agent "${agentDef.id}" does not have a manifest. Store agents with metadata.manifest (YAML string).`
  );
}

/**
 * Convert a LLMAgentManifest into a core AgentDefinition for the Runner.
 */
function manifestToAgentDefinition(manifest: LLMAgentManifest, renderedInstruction: string) {
  return {
    id: manifest.id,
    name: manifest.name ?? manifest.id,
    systemPrompt: renderedInstruction,
    model: {
      provider: manifest.model.provider,
      name: manifest.model.name,
      temperature: manifest.model.temperature,
      maxTokens: manifest.model.maxTokens,
      topP: manifest.model.topP,
    },
    examples: manifest.examples,
    outputSchema: manifest.outputSchema
      ? manifestSchemaToJsonSchema(manifest.outputSchema)
      : undefined,
    tools: manifest.tools
      ? manifestToolsToToolRefs(manifest.tools)
      : undefined,
  };
}

/**
 * Convert the flat manifest outputSchema to a proper JSON Schema.
 */
function manifestSchemaToJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(schema)) {
    if (typeof value === "string") {
      properties[key] = { type: value };
    } else {
      properties[key] = value;
    }
    required.push(key);
  }

  return {
    type: "object",
    properties,
    required,
  };
}

/**
 * Convert manifest tool entries to core ToolReference format.
 */
function manifestToolsToToolRefs(tools: LLMAgentManifest["tools"]) {
  if (!tools) return [];

  const refs: Array<Record<string, unknown>> = [];
  for (const entry of tools) {
    switch (entry.kind) {
      case "mcp":
        refs.push({
          type: "mcp",
          server: entry.server,
          tools: entry.tools
            ? entry.tools.map((t) => (typeof t === "string" ? t : t.tool))
            : undefined,
        });
        break;
      case "local":
        for (const name of entry.tools) {
          refs.push({ type: "inline", name });
        }
        break;
      case "agent":
        refs.push({ type: "agent", agentId: entry.agent });
        break;
    }
  }
  return refs;
}
