import type { Runner, AgentDefinition } from "@agntz/core";
import type {
  ExecutionContext,
  AgentManifest,
  LLMAgentManifest,
  ToolCallConfig,
  AgentState,
} from "@agntz/manifest";
import { parseManifest } from "@agntz/manifest";

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

      const hasSchema = Boolean(manifest.outputSchema);
      const start = Date.now();
      console.log(
        `[llm] ${manifest.id} start ` +
        `model=${manifest.model.provider}/${manifest.model.name} ` +
        `instr=${renderedInstruction.length}ch schema=${hasSchema}`
      );

      try {
        // Build user input from state
        const userInput = state.userQuery
          ? String(state.userQuery)
          : JSON.stringify(state);

        const result = await runner.invoke(tempId, userInput);
        const duration = Date.now() - start;

        // If outputSchema is defined, try to parse structured output
        if (hasSchema) {
          try {
            const parsed = JSON.parse(result.output);
            console.log(
              `[llm] ${manifest.id} done ${duration}ms ` +
              `out=${result.output.length}ch parsed keys=[${Object.keys(parsed).join(",")}]`
            );
            return parsed;
          } catch (err) {
            console.warn(
              `[llm] ${manifest.id} done ${duration}ms ` +
              `out=${result.output.length}ch PARSE FAILED (${(err as Error).message}) — returning raw text`
            );
            return result.output;
          }
        }

        console.log(`[llm] ${manifest.id} done ${duration}ms out=${result.output.length}ch`);
        return result.output;
      } catch (err) {
        const duration = Date.now() - start;
        console.error(`[llm] ${manifest.id} failed ${duration}ms: ${(err as Error).message}`);
        throw err;
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

      const start = Date.now();
      console.log(`[tool] ${toolName} start params=${JSON.stringify(input).slice(0, 200)}`);
      try {
        const result = await runner.tools.execute(toolName, input);
        console.log(`[tool] ${toolName} done ${Date.now() - start}ms`);
        return result;
      } catch (err) {
        console.error(`[tool] ${toolName} failed ${Date.now() - start}ms: ${(err as Error).message}`);
        throw err;
      }
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
      properties[key] = enforceStrictObject(value);
    }
    required.push(key);
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

/**
 * OpenAI strict structured output requires `additionalProperties: false` on every
 * nested object schema. Walk the schema and enforce it.
 */
function enforceStrictObject(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = { ...obj };

  if (obj.type === "object") {
    if (!("additionalProperties" in out)) out.additionalProperties = false;
    const props = obj.properties as Record<string, unknown> | undefined;
    if (props) {
      const walked: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(props)) walked[k] = enforceStrictObject(v);
      out.properties = walked;
    }
  }
  if (obj.type === "array" && obj.items) {
    out.items = enforceStrictObject(obj.items);
  }
  return out;
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
