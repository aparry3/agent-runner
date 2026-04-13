"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { ValidationBanner } from "@/components/validation-banner";

interface ValidationError {
  level: string;
  path: string;
  message: string;
}

interface ValidationWarning {
  path: string;
  message: string;
}

const DEFAULT_MANIFEST = `id: my-agent
name: My Agent
kind: llm

model:
  provider: openai
  name: gpt-4o

instruction: |
  You are a helpful assistant.
`;

export default function NewAgentPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"ai" | "manual">("ai");

  // AI mode state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  // Shared state
  const [manifest, setManifest] = useState("");
  const [agentId, setAgentId] = useState("");
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setExplanation(null);

    try {
      const res = await fetch("/api/agents/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiPrompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAiError(data.error ?? "Failed to generate agent");
        return;
      }

      if (data.yaml) {
        setManifest(data.yaml);
        setExplanation(data.explanation ?? null);

        // Try to extract the agent ID from the generated YAML
        const idMatch = data.yaml.match(/^id:\s*(.+)$/m);
        if (idMatch) {
          setAgentId(idMatch[1].trim());
        }

        // Validate
        await validateManifest(data.yaml);
      }
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAiLoading(false);
    }
  };

  const validateManifest = async (yaml: string) => {
    try {
      const res = await fetch("/api/agents/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifest: yaml }),
      });
      const result = await res.json();
      setErrors(result.errors ?? []);
      setWarnings(result.warnings ?? []);
    } catch {
      // ignore
    }
  };

  const handleManifestChange = (yaml: string) => {
    setManifest(yaml);
    // Extract agent ID from YAML
    const idMatch = yaml.match(/^id:\s*(.+)$/m);
    if (idMatch) {
      setAgentId(idMatch[1].trim());
    }
    // Debounced validation
    const timer = setTimeout(() => validateManifest(yaml), 500);
    return () => clearTimeout(timer);
  };

  const handleCreate = async () => {
    if (!agentId.trim() || !manifest.trim()) return;

    const structuralErrors = errors.filter((e) => e.level === "structural");
    if (structuralErrors.length > 0) return;

    setCreating(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: agentId, name: agentId, manifest }),
      });

      if (res.ok) {
        router.push(`/agents/${agentId}`);
      } else {
        const data = await res.json();
        setAiError(data.error ?? "Failed to create agent");
      }
    } catch (e) {
      setAiError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const switchToManual = () => {
    setMode("manual");
    if (!manifest) {
      setManifest(DEFAULT_MANIFEST);
      setAgentId("my-agent");
    }
  };

  return (
    <div className="max-w-4xl">
      <Breadcrumb
        items={[
          { label: "Agents", href: "/agents" },
          { label: "New Agent" },
        ]}
      />

      <h1 className="text-2xl font-bold mb-6">Create Agent</h1>

      {/* AI Generation Section */}
      {mode === "ai" && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Describe the agent you want to create
          </label>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g., An agent that analyzes customer support tickets and categorizes them by urgency and topic..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-sm resize-none h-28 focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleGenerate}
              disabled={aiLoading || !aiPrompt.trim()}
              className="bg-zinc-100 text-zinc-900 px-5 py-2 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              {aiLoading ? "Generating..." : "Generate"}
            </button>
            <button
              onClick={switchToManual}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Skip AI, start from scratch
            </button>
          </div>
        </div>
      )}

      {aiError && (
        <div className="border border-red-800 bg-red-950/40 rounded-lg p-3 mb-4 text-sm text-red-300">
          {aiError}
        </div>
      )}

      {explanation && (
        <div className="border border-zinc-700 bg-zinc-900/50 rounded-lg p-3 mb-4">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">
            Design Explanation
          </div>
          <p className="text-sm text-zinc-300">{explanation}</p>
        </div>
      )}

      {/* Manifest Editor (shown after generation or in manual mode) */}
      {(manifest || mode === "manual") && (
        <div>
          <ValidationBanner errors={errors} warnings={warnings} />

          <div className="mt-4 mb-4">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Agent ID
            </label>
            <input
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="my-agent-id"
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono w-full max-w-xs focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Agent Manifest (YAML)
            </label>
            <textarea
              value={manifest}
              onChange={(e) => handleManifestChange(e.target.value)}
              className={`w-full bg-zinc-900 border rounded-lg p-4 font-mono text-sm resize-none h-96 focus:outline-none ${
                errors.length > 0
                  ? "border-red-700 focus:border-red-500"
                  : warnings.length > 0
                    ? "border-yellow-700 focus:border-yellow-500"
                    : "border-zinc-700 focus:border-zinc-500"
              }`}
              spellCheck={false}
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={
              creating ||
              !agentId.trim() ||
              !manifest.trim() ||
              errors.filter((e) => e.level === "structural").length > 0
            }
            className="bg-zinc-100 text-zinc-900 px-5 py-2 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating..." : "Create Agent"}
          </button>
        </div>
      )}
    </div>
  );
}
