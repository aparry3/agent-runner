"use client";

import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { parse as parseYAML, stringify as stringifyYAML } from "yaml";
import { Breadcrumb } from "@/components/breadcrumb";
import { CopyButton } from "@/components/copy-button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ValidationBanner } from "@/components/validation-banner";
import { PanelToggle } from "@/components/panel-toggle";

interface ValidationError {
  level: string;
  path: string;
  message: string;
}

interface ValidationWarning {
  path: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface VersionEntry {
  createdAt: string;
  activatedAt: string | null;
}

interface ExampleEntry {
  input: string;
  output: string;
}

export default function AgentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // Core state
  const [manifest, setManifest] = useState("");
  const [instruction, setInstruction] = useState("");
  const [agentName, setAgentName] = useState(id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Validation
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Editor mode
  const [editorMode, setEditorMode] = useState<"yaml" | "instruction" | "both">("yaml");

  // AI input
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Examples
  const [examples, setExamples] = useState<ExampleEntry[]>([]);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [editingExample, setEditingExample] = useState<number | null>(null);
  const [newExample, setNewExample] = useState<ExampleEntry | null>(null);

  // Versions
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);

  // Delete
  const [showDelete, setShowDelete] = useState(false);

  // Track which panel is actively being edited
  const activePanel = useRef<"yaml" | "instruction" | null>(null);

  // ═══ Load agent ═══

  useEffect(() => {
    fetch(`/api/agents/${id}`)
      .then((r) => r.json())
      .then((agent) => {
        const manifestYaml = agent.metadata?.manifest ?? "";
        setManifest(manifestYaml);
        setAgentName(agent.name ?? id);
        extractFromManifest(manifestYaml);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const extractFromManifest = (yaml: string) => {
    try {
      const parsed = parseYAML(yaml);
      if (parsed?.instruction) {
        setInstruction(parsed.instruction);
      }
      if (parsed?.name) {
        setAgentName(parsed.name);
      }
      if (parsed?.examples && Array.isArray(parsed.examples)) {
        setExamples(parsed.examples);
      } else {
        setExamples([]);
      }
    } catch {
      // Invalid YAML, ignore extraction
    }
  };

  // ═══ Validation ═══

  const validateDebounced = useCallback((yaml: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!yaml.trim()) {
        setValidation(null);
        return;
      }
      setValidating(true);
      try {
        const res = await fetch("/api/agents/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manifest: yaml }),
        });
        const result = await res.json();
        setValidation(result);
      } catch {
        // Ignore
      } finally {
        setValidating(false);
      }
    }, 500);
  }, []);

  // ═══ Manifest change handlers ═══

  const handleManifestChange = (value: string) => {
    setManifest(value);
    setStatus(null);
    validateDebounced(value);
    // Only extract if YAML panel is active
    if (activePanel.current === "yaml") {
      extractFromManifest(value);
    }
  };

  const handleInstructionChange = (value: string) => {
    setInstruction(value);
    setStatus(null);
    // Update the full manifest YAML
    try {
      const parsed = parseYAML(manifest);
      if (parsed && typeof parsed === "object") {
        parsed.instruction = value;
        const updated = stringifyYAML(parsed, { lineWidth: 0 });
        setManifest(updated);
        validateDebounced(updated);
      }
    } catch {
      // If YAML is invalid, just update instruction state
    }
  };

  // ═══ Examples ═══

  const updateExamplesInManifest = (newExamples: ExampleEntry[]) => {
    setExamples(newExamples);
    try {
      const parsed = parseYAML(manifest);
      if (parsed && typeof parsed === "object") {
        if (newExamples.length > 0) {
          parsed.examples = newExamples;
        } else {
          delete parsed.examples;
        }
        const updated = stringifyYAML(parsed, { lineWidth: 0 });
        setManifest(updated);
        validateDebounced(updated);
      }
    } catch {
      // ignore
    }
  };

  const handleAddExample = () => {
    if (!newExample || !newExample.input.trim() || !newExample.output.trim()) return;
    updateExamplesInManifest([...examples, newExample]);
    setNewExample(null);
  };

  const handleUpdateExample = (index: number, updated: ExampleEntry) => {
    const next = [...examples];
    next[index] = updated;
    updateExamplesInManifest(next);
    setEditingExample(null);
  };

  const handleDeleteExample = (index: number) => {
    updateExamplesInManifest(examples.filter((_, i) => i !== index));
  };

  // ═══ Save ═══

  const handleSave = async () => {
    if (validation && !validation.valid) {
      setStatus("Fix validation errors before saving");
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifest }),
      });
      if (res.ok) {
        const body = await res.json();
        const warnCount = body.warnings?.length ?? 0;
        setStatus(warnCount > 0 ? `Saved (${warnCount} warnings)` : "Saved");
        // Refresh versions
        loadVersions();
      } else {
        const body = await res.json();
        setStatus(`Error: ${body.error}`);
      }
    } catch (e) {
      setStatus(`Error: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  // ═══ Delete ═══

  const handleDelete = async () => {
    await fetch(`/api/agents/${id}`, { method: "DELETE" });
    router.push("/agents");
  };

  // ═══ AI Builder ═══

  const handleAiApply = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch("/api/agents/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: aiPrompt,
          currentManifest: manifest || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setAiError(data.error ?? "Failed to generate");
        return;
      }

      if (data.yaml) {
        setManifest(data.yaml);
        extractFromManifest(data.yaml);
        validateDebounced(data.yaml);
        setAiPrompt("");
        setAiOpen(false);
      }
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAiLoading(false);
    }
  };

  // ═══ Versions ═══

  const loadVersions = async () => {
    try {
      const res = await fetch(`/api/agents/${id}/versions`);
      const data = await res.json();
      setVersions(data);
    } catch {
      // ignore
    }
  };

  const handleLoadVersion = async (createdAt: string) => {
    try {
      const res = await fetch(
        `/api/agents/${id}/versions/${encodeURIComponent(createdAt)}`
      );
      const agent = await res.json();
      if (agent?.metadata?.manifest) {
        setManifest(agent.metadata.manifest);
        extractFromManifest(agent.metadata.manifest);
        validateDebounced(agent.metadata.manifest);
        setStatus("Version loaded — save to make it active");
      }
    } catch {
      // ignore
    }
  };

  const handleActivateVersion = async (createdAt: string) => {
    try {
      await fetch(
        `/api/agents/${id}/versions/${encodeURIComponent(createdAt)}/activate`,
        { method: "POST" }
      );
      loadVersions();
      setStatus("Version activated");
    } catch {
      // ignore
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return ts;
    }
  };

  // ═══ Render ═══

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  const hasErrors = validation && validation.errors.length > 0;
  const hasWarnings = validation && validation.warnings.length > 0;

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Agents", href: "/agents" },
          { label: agentName },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{agentName}</h1>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-sm text-zinc-500 font-mono">{id}</span>
            <CopyButton text={id} />
            <Link
              href={`/agents/${id}/playground`}
              className="ml-3 text-sm text-blue-400 hover:text-blue-300"
            >
              Playground
            </Link>
            {validating && (
              <span className="ml-3 text-sm text-zinc-500">Validating...</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {status && (
            <span
              className={`text-sm ${
                status.startsWith("Error") || status.startsWith("Fix")
                  ? "text-red-400"
                  : "text-green-400"
              }`}
            >
              {status}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || (hasErrors ?? false)}
            className="bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="bg-red-900/50 text-red-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-900 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* AI Input Box */}
      <div className="mb-6">
        <button
          onClick={() => setAiOpen(!aiOpen)}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-2"
        >
          <svg
            className={`w-4 h-4 transition-transform ${aiOpen ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Make Edits with AI
        </button>

        {aiOpen && (
          <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50">
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe the changes you want to make..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm resize-none h-20 focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
            />
            {aiError && (
              <p className="text-sm text-red-400 mt-2">{aiError}</p>
            )}
            <div className="flex justify-end mt-2">
              <button
                onClick={handleAiApply}
                disabled={aiLoading || !aiPrompt.trim()}
                className="bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
              >
                {aiLoading ? "Applying..." : "Apply Changes"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Validation Banners */}
      {validation && (hasErrors || hasWarnings) && (
        <div className="mb-6">
          <ValidationBanner
            errors={validation.errors}
            warnings={validation.warnings}
          />
        </div>
      )}

      {/* Agent Definition Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-300">Agent Definition</h3>
          <PanelToggle value={editorMode} onChange={setEditorMode} />
        </div>

        <div
          className={
            editorMode === "both" ? "grid grid-cols-2 gap-4" : ""
          }
        >
          {(editorMode === "yaml" || editorMode === "both") && (
            <div>
              {editorMode === "both" && (
                <div className="text-xs text-zinc-500 mb-1">YAML</div>
              )}
              <textarea
                value={manifest}
                onChange={(e) => handleManifestChange(e.target.value)}
                onFocus={() => (activePanel.current = "yaml")}
                onBlur={() => (activePanel.current = null)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                className={`w-full bg-zinc-900 border rounded-lg p-4 font-mono text-sm resize-none focus:outline-none ${
                  hasErrors
                    ? "border-red-700 focus:border-red-500"
                    : hasWarnings
                      ? "border-yellow-700 focus:border-yellow-500"
                      : "border-zinc-700 focus:border-zinc-500"
                } ${editorMode === "both" ? "h-[500px]" : "h-[500px]"}`}
                spellCheck={false}
                placeholder="# Write your agent YAML manifest here..."
              />
            </div>
          )}

          {(editorMode === "instruction" || editorMode === "both") && (
            <div>
              {editorMode === "both" && (
                <div className="text-xs text-zinc-500 mb-1">Instruction Template</div>
              )}
              <textarea
                value={instruction}
                onChange={(e) => handleInstructionChange(e.target.value)}
                onFocus={() => (activePanel.current = "instruction")}
                onBlur={() => (activePanel.current = null)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-4 font-mono text-sm resize-none h-[500px] focus:outline-none focus:border-zinc-500"
                spellCheck={false}
                placeholder="Write the agent's instruction template here..."
              />
            </div>
          )}
        </div>
      </div>

      {/* Examples Section */}
      <div className="mb-8">
        <button
          onClick={() => setExamplesOpen(!examplesOpen)}
          className="flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition-colors mb-3"
        >
          <svg
            className={`w-4 h-4 transition-transform ${examplesOpen ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Examples
          {examples.length > 0 && (
            <span className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded-full">
              {examples.length}
            </span>
          )}
        </button>

        {examplesOpen && (
          <div className="space-y-2">
            {examples.map((ex, i) => (
              <div
                key={i}
                className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/50"
              >
                {editingExample === i ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-zinc-500 block mb-1">Input</label>
                      <textarea
                        defaultValue={ex.input}
                        id={`example-input-${i}`}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm font-mono resize-none h-20 focus:outline-none focus:border-zinc-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 block mb-1">Output</label>
                      <textarea
                        defaultValue={ex.output}
                        id={`example-output-${i}`}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm font-mono resize-none h-20 focus:outline-none focus:border-zinc-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const inputEl = document.getElementById(`example-input-${i}`) as HTMLTextAreaElement;
                          const outputEl = document.getElementById(`example-output-${i}`) as HTMLTextAreaElement;
                          handleUpdateExample(i, {
                            input: inputEl.value,
                            output: outputEl.value,
                          });
                        }}
                        className="text-xs bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded hover:bg-zinc-600 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingExample(null)}
                        className="text-xs text-zinc-500 px-3 py-1.5 rounded hover:text-zinc-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-500 mb-1">Input</div>
                      <pre className="text-sm text-zinc-300 whitespace-pre-wrap break-words mb-2 font-mono">
                        {ex.input}
                      </pre>
                      <div className="text-xs text-zinc-500 mb-1">Output</div>
                      <pre className="text-sm text-zinc-300 whitespace-pre-wrap break-words font-mono">
                        {ex.output}
                      </pre>
                    </div>
                    <div className="flex gap-1 ml-3 shrink-0">
                      <button
                        onClick={() => setEditingExample(i)}
                        className="w-7 h-7 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteExample(i)}
                        className="w-7 h-7 flex items-center justify-center rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {newExample ? (
              <div className="border border-zinc-700 rounded-lg p-3 bg-zinc-900/50 space-y-2">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Input</label>
                  <textarea
                    value={newExample.input}
                    onChange={(e) =>
                      setNewExample({ ...newExample, input: e.target.value })
                    }
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm font-mono resize-none h-20 focus:outline-none focus:border-zinc-500"
                    placeholder="Example input..."
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Output</label>
                  <textarea
                    value={newExample.output}
                    onChange={(e) =>
                      setNewExample({ ...newExample, output: e.target.value })
                    }
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm font-mono resize-none h-20 focus:outline-none focus:border-zinc-500"
                    placeholder="Expected output..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddExample}
                    disabled={!newExample.input.trim() || !newExample.output.trim()}
                    className="text-xs bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded hover:bg-zinc-600 disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setNewExample(null)}
                    className="text-xs text-zinc-500 px-3 py-1.5 rounded hover:text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setNewExample({ input: "", output: "" })}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                + Add example
              </button>
            )}
          </div>
        )}
      </div>

      {/* Versions Section */}
      <div className="mb-8">
        <button
          onClick={() => {
            setVersionsOpen(!versionsOpen);
            if (!versionsOpen && versions.length === 0) {
              loadVersions();
            }
          }}
          className="flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition-colors mb-3"
        >
          <svg
            className={`w-4 h-4 transition-transform ${versionsOpen ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Version History
          {versions.length > 0 && (
            <span className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded-full">
              {versions.length}
            </span>
          )}
        </button>

        {versionsOpen && (
          <div className="space-y-1">
            {versions.length === 0 ? (
              <p className="text-sm text-zinc-500 py-2">
                No versions yet. Versions are created each time you save.
              </p>
            ) : (
              versions.map((v, i) => {
                const isActive =
                  i === 0 ||
                  (v.activatedAt &&
                    versions.every(
                      (other) =>
                        other === v ||
                        !other.activatedAt ||
                        other.activatedAt <= v.activatedAt!
                    ));

                return (
                  <div
                    key={v.createdAt}
                    className={`flex items-center justify-between border rounded-lg px-3 py-2 ${
                      isActive
                        ? "border-zinc-600 bg-zinc-800/50"
                        : "border-zinc-800 bg-zinc-900/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-zinc-300">
                        {formatTimestamp(v.createdAt)}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {v.createdAt}
                      </span>
                      {isActive && (
                        <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded">
                          active
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleLoadVersion(v.createdAt)}
                        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        Load
                      </button>
                      {!isActive && (
                        <button
                          onClick={() => handleActivateVersion(v.createdAt)}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={showDelete}
        title="Delete Agent"
        message={`Are you sure you want to delete "${agentName}"? All versions will be permanently removed.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
