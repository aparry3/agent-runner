import type { ModelConfig, ModelProvider, GenerateTextOptions, GenerateTextResult, ModelStreamResult, TokenUsage } from "./types.js";

/**
 * Default model provider using the Vercel AI SDK (`ai` package).
 * This is just a client library — calls go directly to OpenAI/Anthropic/Google
 * with the user's own API keys. No Vercel services involved.
 */
export class AISDKModelProvider implements ModelProvider {
  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const { generateText } = await import("ai");
    const model = await this.resolveModel(options.model);

    const messages = options.messages.map(m => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    }));

    // Build tools map for the AI SDK
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: Record<string, any> = {};
    if (options.tools?.length) {
      const { tool: aiTool } = await import("ai");
      const { z } = await import("zod");

      for (const t of options.tools) {
        tools[t.name] = aiTool({
          description: t.description,
          parameters: jsonSchemaToZod(t.parameters, z),
        });
      }
    }

    const result = await generateText({
      model,
      messages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      maxSteps: 1,
      abortSignal: options.signal,
    });

    return {
      text: result.text ?? "",
      toolCalls: result.toolCalls?.map(tc => ({
        id: tc.toolCallId,
        name: tc.toolName,
        args: tc.args,
      })),
      usage: {
        promptTokens: result.usage?.promptTokens ?? 0,
        completionTokens: result.usage?.completionTokens ?? 0,
        totalTokens: (result.usage?.promptTokens ?? 0) + (result.usage?.completionTokens ?? 0),
      },
      finishReason: result.finishReason ?? "stop",
    };
  }

  async streamText(options: GenerateTextOptions): Promise<ModelStreamResult> {
    const { streamText } = await import("ai");
    const model = await this.resolveModel(options.model);

    const messages = options.messages.map(m => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    }));

    // Build tools map
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: Record<string, any> = {};
    if (options.tools?.length) {
      const { tool: aiTool } = await import("ai");
      const { z } = await import("zod");

      for (const t of options.tools) {
        tools[t.name] = aiTool({
          description: t.description,
          parameters: jsonSchemaToZod(t.parameters, z),
        });
      }
    }

    const result = streamText({
      model,
      messages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      maxSteps: 1,
      abortSignal: options.signal,
    });

    const toolCallsPromise = result.toolCalls.then(tcs =>
      tcs.map(tc => ({ id: tc.toolCallId, name: tc.toolName, args: tc.args }))
    );
    const usagePromise = result.usage.then(u => ({
      promptTokens: u?.promptTokens ?? 0,
      completionTokens: u?.completionTokens ?? 0,
      totalTokens: (u?.promptTokens ?? 0) + (u?.completionTokens ?? 0),
    }));
    const finishReasonPromise = Promise.resolve(result.finishReason) as Promise<string>;

    return {
      textStream: result.textStream,
      toolCalls: toolCallsPromise,
      usage: usagePromise,
      finishReason: finishReasonPromise,
      async toResult(): Promise<GenerateTextResult> {
        const text = await result.text;
        const toolCalls = await toolCallsPromise;
        const usage = await usagePromise;
        const finishReason = await finishReasonPromise;
        return { text, toolCalls, usage, finishReason };
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async resolveModel(config: ModelConfig): Promise<any> {
    const { provider, name } = config;

    switch (provider) {
      case "openai": {
        const { openai } = await import("@ai-sdk/openai");
        return openai(name);
      }
      case "anthropic": {
        const { anthropic } = await import("@ai-sdk/anthropic");
        return anthropic(name);
      }
      case "google": {
        const { google } = await import("@ai-sdk/google");
        return google(name);
      }
      default:
        throw new Error(
          `Unknown model provider "${provider}". ` +
          `Supported: openai, anthropic, google. ` +
          `For other providers, pass a custom modelProvider to createRunner().`
        );
    }
  }
}

/**
 * Convert a JSON Schema object to a basic Zod schema.
 * This is a simplified conversion for passing tool parameters to the AI SDK.
 */
function jsonSchemaToZod(schema: Record<string, unknown>, z: typeof import("zod").z): import("zod").ZodSchema {
  if (!schema || schema.type !== "object") {
    return z.object({});
  }

  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = (schema.required ?? []) as string[];
  const shape: Record<string, import("zod").ZodSchema> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let field: import("zod").ZodSchema;

    switch (prop.type) {
      case "string":
        if (prop.enum) {
          field = z.enum(prop.enum as [string, ...string[]]);
        } else {
          field = z.string();
        }
        break;
      case "number":
        field = z.number();
        break;
      case "boolean":
        field = z.boolean();
        break;
      case "array":
        field = z.array(z.unknown());
        break;
      case "object":
        field = z.record(z.unknown());
        break;
      default:
        field = z.unknown();
    }

    if (!required.includes(key)) {
      field = field.optional() as unknown as import("zod").ZodSchema;
    }

    if (prop.description) {
      field = field.describe(prop.description as string);
    }

    shape[key] = field;
  }

  return z.object(shape);
}
