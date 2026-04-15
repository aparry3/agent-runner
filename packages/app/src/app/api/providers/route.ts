import { NextResponse } from "next/server";
import { requireUserContext, AuthRequiredError } from "@/lib/user";

const SUPPORTED_PROVIDERS = [
  { id: "openai", name: "OpenAI", models: ["gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-5.4-pro"] },
  { id: "anthropic", name: "Anthropic", models: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"] },
  { id: "google", name: "Google", models: ["gemini-3.1-pro-preview", "gemini-3-flash", "gemini-3.1-flash-lite-preview"] },
  { id: "mistral", name: "Mistral", models: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"] },
  { id: "xai", name: "xAI", models: ["grok-4.20", "grok-4.1", "grok-4.1-mini"] },
  { id: "groq", name: "Groq", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"] },
  { id: "deepseek", name: "DeepSeek", models: ["deepseek-chat", "deepseek-reasoner"] },
  { id: "perplexity", name: "Perplexity", models: ["sonar-pro", "sonar", "sonar-reasoning-pro", "sonar-reasoning", "sonar-deep-research"] },
  { id: "cohere", name: "Cohere", models: ["command-a-03-2025", "command-r-plus-08-2024", "command-r-08-2024", "command-r7b"] },
  { id: "azure", name: "Azure OpenAI", models: [] },
];

export async function GET() {
  try {
    const { runner } = await requireUserContext();
    const stored = runner.providers ? await runner.providers.listProviders() : [];
    const storedMap = new Map(stored.map((p) => [p.id, p.configured]));

    const providers = SUPPORTED_PROVIDERS.map((p) => ({
      ...p,
      configured: storedMap.get(p.id) ?? false,
    }));

    return NextResponse.json(providers);
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
