import type {
  RunnerConfig,
  AgentDefinition,
  ToolDefinition,
  InvokeOptions,
  InvokeResult,
  ToolCallRecord,
  ToolInfo,
  ToolContext,
  ContextEntry,
  Message,
  InvocationLog,
  TokenUsage,
  AgentStore,
  SessionStore,
  ContextStore,
  LogStore,
  ModelProvider,
} from "./types.js";
import { ToolRegistry } from "./tool.js";
import { MemoryStore } from "./stores/memory.js";
import { AISDKModelProvider } from "./model-provider.js";
import { buildMessages, trimHistory } from "./message-builder.js";
import { generateInvocationId } from "./utils/id.js";

/** Maximum tool call iterations to prevent infinite loops */
const DEFAULT_MAX_STEPS = 10;

/**
 * The Runner. Central orchestrator for agent-runner.
 * Created via createRunner().
 */
export class Runner {
  private agentStore: AgentStore;
  private sessionStore: SessionStore;
  private contextStore: ContextStore;
  private logStore: LogStore;
  private modelProvider: ModelProvider;
  private toolRegistry: ToolRegistry;
  private config: RunnerConfig;

  /** Agents registered in code (not persisted to store) */
  private registeredAgents = new Map<string, AgentDefinition>();

  constructor(config: RunnerConfig = {}) {
    this.config = config;

    // Set up stores — unified or split
    if (config.store) {
      this.agentStore = config.store;
      this.sessionStore = config.store;
      this.contextStore = config.store;
      this.logStore = config.store;
    } else {
      const defaultStore = new MemoryStore();
      this.agentStore = config.agentStore ?? defaultStore;
      this.sessionStore = config.sessionStore ?? defaultStore;
      this.contextStore = config.contextStore ?? defaultStore;
      this.logStore = config.logStore ?? defaultStore;
    }

    // Model provider
    this.modelProvider = config.modelProvider ?? new AISDKModelProvider();

    // Tool registry
    this.toolRegistry = new ToolRegistry();

    // Register initial tools
    if (config.tools) {
      for (const tool of config.tools) {
        this.toolRegistry.register(tool);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Agent Management
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Register an agent in memory (not persisted to store).
   * For persisted agents, use the agent store directly.
   */
  registerAgent(agent: AgentDefinition): void {
    this.registeredAgents.set(agent.id, agent);
  }

  /**
   * Register a tool in the registry.
   */
  registerTool(tool: ToolDefinition): void {
    this.toolRegistry.register(tool);
  }

  /**
   * Resolve an agent by ID — checks registered agents first, then the store.
   */
  private async resolveAgent(agentId: string): Promise<AgentDefinition> {
    const registered = this.registeredAgents.get(agentId);
    if (registered) return registered;

    const stored = await this.agentStore.getAgent(agentId);
    if (stored) return stored;

    throw new Error(`Agent "${agentId}" not found. Register it with runner.registerAgent() or add it to the agent store.`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Tool Registry (public API)
  // ═══════════════════════════════════════════════════════════════════

  get tools() {
    return {
      list: (): ToolInfo[] => this.toolRegistry.list(),
      get: (name: string): ToolInfo | undefined => this.toolRegistry.get(name),
      execute: async (name: string, input: unknown): Promise<unknown> => {
        const ctx: ToolContext = {
          agentId: "__direct__",
          invocationId: generateInvocationId(),
          invoke: (agentId: string, input: string, options?: InvokeOptions) =>
            this.invoke(agentId, input, options),
        };
        return this.toolRegistry.execute(name, input, ctx);
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Context (public API)
  // ═══════════════════════════════════════════════════════════════════

  get context() {
    return {
      get: (contextId: string) => this.contextStore.getContext(contextId),
      add: (contextId: string, entry: Omit<ContextEntry, "contextId">) =>
        this.contextStore.addContext(contextId, { ...entry, contextId }),
      clear: (contextId: string) => this.contextStore.clearContext(contextId),
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Invocation
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Invoke an agent. This is the main entry point for running an agent.
   */
  async invoke(agentId: string, input: string, options: InvokeOptions = {}): Promise<InvokeResult> {
    const startTime = Date.now();
    const invocationId = generateInvocationId();
    const agent = await this.resolveAgent(agentId);

    // Resolve model config (agent model or defaults)
    const modelConfig = {
      ...this.config.defaults?.model,
      ...agent.model,
      temperature: agent.model.temperature ?? this.config.defaults?.temperature,
      maxTokens: agent.model.maxTokens ?? this.config.defaults?.maxTokens,
    };

    // Load session history
    let sessionHistory: Message[] = [];
    if (options.sessionId) {
      sessionHistory = await this.sessionStore.getMessages(options.sessionId);
      const maxMessages = this.config.session?.maxMessages ?? 50;
      sessionHistory = trimHistory(sessionHistory, maxMessages);
    }

    // Load context entries
    let contextEntries: Map<string, ContextEntry[]> | undefined;
    if (options.contextIds?.length) {
      contextEntries = new Map();
      for (const contextId of options.contextIds) {
        const entries = await this.contextStore.getContext(contextId);
        if (entries.length > 0) {
          // Apply context limits
          const maxEntries = this.config.context?.maxEntries ?? 20;
          const trimmed = entries.slice(-maxEntries);
          contextEntries.set(contextId, trimmed);
        }
      }
    }

    // Build messages
    const messages = buildMessages({
      agent,
      input,
      sessionHistory,
      contextEntries,
      extraContext: options.extraContext,
    });

    // Resolve available tools for this agent
    const availableTools = this.resolveToolsForAgent(agent);

    // Execute the agent loop (model → tools → repeat)
    const allToolCalls: ToolCallRecord[] = [];
    const totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let finalOutput = "";
    let step = 0;

    while (step < DEFAULT_MAX_STEPS) {
      step++;

      // Check for cancellation
      if (options.signal?.aborted) {
        throw new Error("Invocation was cancelled");
      }

      // Build output schema if the agent defines one
      const outputSchema = agent.outputSchema
        ? { name: `${agent.id}_output`, schema: agent.outputSchema }
        : undefined;

      // Call the model
      const result = await this.modelProvider.generateText({
        model: modelConfig,
        messages,
        tools: availableTools.length > 0 ? availableTools : undefined,
        outputSchema,
        signal: options.signal,
      });

      // Accumulate usage
      totalUsage.promptTokens += result.usage.promptTokens;
      totalUsage.completionTokens += result.usage.completionTokens;
      totalUsage.totalTokens += result.usage.totalTokens;

      // If no tool calls, we're done
      if (!result.toolCalls?.length) {
        finalOutput = result.text;
        break;
      }

      // Execute tool calls
      const toolResults: Array<{ id: string; result: string }> = [];

      for (const tc of result.toolCalls) {
        const toolStartTime = Date.now();
        const toolCtx: ToolContext = {
          agentId,
          sessionId: options.sessionId,
          contextIds: options.contextIds,
          invocationId,
          invoke: (agentId: string, input: string, opts?: InvokeOptions) =>
            this.invoke(agentId, input, opts),
          ...(options.toolContext ?? {}),
        };

        let output: unknown;
        let error: string | undefined;

        try {
          output = await this.toolRegistry.execute(tc.name, tc.args, toolCtx);
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          output = { error };
        }

        const toolCallRecord: ToolCallRecord = {
          id: tc.id,
          name: tc.name,
          input: tc.args,
          output,
          duration: Date.now() - toolStartTime,
          error,
        };
        allToolCalls.push(toolCallRecord);

        toolResults.push({
          id: tc.id,
          result: typeof output === "string" ? output : JSON.stringify(output),
        });
      }

      // Add assistant message with tool calls to the conversation
      if (result.text) {
        messages.push({ role: "assistant", content: result.text });
      }

      // Add tool call request as assistant message
      messages.push({
        role: "assistant",
        content: result.toolCalls.map(tc =>
          `[Tool Call: ${tc.name}(${JSON.stringify(tc.args)})]`
        ).join("\n"),
      });

      // Add tool results
      for (const tr of toolResults) {
        messages.push({ role: "tool" as string, content: tr.result });
      }

      // If the model also produced text along with tool calls, that's the final output
      if (result.finishReason === "stop" && result.text) {
        finalOutput = result.text;
        break;
      }
    }

    const duration = Date.now() - startTime;
    const modelStr = `${modelConfig.provider}/${modelConfig.name}`;

    // Save to session
    if (options.sessionId) {
      const now = new Date().toISOString();
      const newMessages: Message[] = [
        { role: "user", content: input, timestamp: now },
        {
          role: "assistant",
          content: finalOutput,
          toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
          timestamp: now,
        },
      ];
      await this.sessionStore.append(options.sessionId, newMessages);
    }

    // Write to context if agent has contextWrite enabled
    if (agent.contextWrite && options.contextIds?.length && finalOutput) {
      for (const contextId of options.contextIds) {
        await this.contextStore.addContext(contextId, {
          contextId,
          agentId,
          invocationId,
          content: finalOutput,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Log the invocation
    const logEntry: InvocationLog = {
      id: invocationId,
      agentId,
      sessionId: options.sessionId,
      input,
      output: finalOutput,
      toolCalls: allToolCalls,
      usage: totalUsage,
      duration,
      model: modelStr,
      timestamp: new Date().toISOString(),
    };
    await this.logStore.log(logEntry);

    return {
      output: finalOutput,
      invocationId,
      toolCalls: allToolCalls,
      usage: totalUsage,
      duration,
      model: modelStr,
    };
  }

  /**
   * Resolve the tools available to an agent based on its tools[] references.
   * Returns tool metadata for the model AND registers ephemeral agent-tools
   * in the registry so they can be executed during the invoke loop.
   */
  private resolveToolsForAgent(agent: AgentDefinition): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    if (!agent.tools?.length) return [];

    const resolved: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }> = [];

    for (const ref of agent.tools) {
      if (ref.type === "inline") {
        const info = this.toolRegistry.get(ref.name);
        if (info) {
          resolved.push({
            name: info.name,
            description: info.description,
            parameters: info.inputSchema,
          });
        }
      } else if (ref.type === "agent") {
        const toolInfo = this.resolveAgentAsTool(ref.agentId);
        if (toolInfo) {
          resolved.push(toolInfo);
        }
      }
      // TODO: MCP tool resolution (Phase 2)
    }

    return resolved;
  }

  /**
   * Resolve an agent-as-tool reference. Creates a synthetic tool in the registry
   * that invokes the target agent when called.
   */
  private resolveAgentAsTool(agentId: string): {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  } | null {
    const toolName = `invoke_${agentId}`;

    // If already registered (from a previous resolve), just return the info
    const existing = this.toolRegistry.get(toolName);
    if (existing) {
      return {
        name: existing.name,
        description: existing.description,
        parameters: existing.inputSchema,
      };
    }

    // Look up the target agent to get its description
    const targetAgent = this.registeredAgents.get(agentId);
    const description = targetAgent
      ? `Invoke the "${targetAgent.name}" agent: ${targetAgent.description ?? targetAgent.systemPrompt.slice(0, 100)}`
      : `Invoke the "${agentId}" agent`;

    // Dynamically import zod to create the schema
    // We use a simple schema: { input: string }
    const { z } = require("zod");

    const agentTool: ToolDefinition = {
      name: toolName,
      description,
      input: z.object({
        input: z.string().describe("The input/question to send to the agent"),
      }),
      async execute(input: { input: string }, ctx: ToolContext) {
        const result = await ctx.invoke(agentId, input.input);
        return { output: result.output, toolCalls: result.toolCalls.length };
      },
    };

    this.toolRegistry.register(agentTool);

    const info = this.toolRegistry.get(toolName);
    return info ? {
      name: info.name,
      description: info.description,
      parameters: info.inputSchema,
    } : null;
  }
}

/**
 * Create a runner instance. This is the primary entry point for agent-runner.
 */
export function createRunner(config: RunnerConfig = {}): Runner {
  return new Runner(config);
}
