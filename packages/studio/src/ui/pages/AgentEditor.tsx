import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../hooks/useApi";
import { PageHeader, Card, Button, Input, TextArea, Select, Label, FieldGroup, Badge, Spinner, ErrorBox } from "../components/shared";

const PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "mistral", label: "Mistral" },
  { value: "groq", label: "Groq" },
];

const MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini", "o3-mini"],
  anthropic: ["claude-sonnet-4-20250514", "claude-opus-4-20250512", "claude-3-5-haiku-20241022"],
  google: ["gemini-2.5-pro", "gemini-2.0-flash"],
  mistral: ["mistral-large-latest", "mistral-small-latest"],
  groq: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
};

export function AgentEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [agent, setAgent] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    model: { provider: "openai", name: "gpt-4o-mini", temperature: 0.7, maxTokens: 4096 },
    contextWrite: false,
    version: "",
    tags: [] as string[],
  });

  useEffect(() => {
    if (!id) return;
    api.getAgent(id).then((a) => {
      setAgent({
        name: a.name || "",
        description: a.description || "",
        systemPrompt: a.systemPrompt || "",
        model: {
          provider: a.model?.provider || "openai",
          name: a.model?.name || "gpt-4o-mini",
          temperature: a.model?.temperature ?? 0.7,
          maxTokens: a.model?.maxTokens ?? 4096,
        },
        contextWrite: a.contextWrite || false,
        version: a.version || "",
        tags: a.tags || [],
      });
      setLoading(false);
    }).catch((e) => {
      setError(e.message);
      setLoading(false);
    });
  }, [id]);

  const update = (patch: Partial<typeof agent>) => {
    setAgent((a) => ({ ...a, ...patch }));
    setDirty(true);
  };

  const save = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await api.putAgent(id, agent);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm(`Delete agent "${id}"?`)) return;
    await api.deleteAgent(id);
    navigate("/agents");
  };

  if (loading) return <Spinner />;
  if (error && !agent.name) return <ErrorBox message={error} />;

  return (
    <div style={{ maxWidth: 800 }}>
      <PageHeader
        title={agent.name || id || "Agent"}
        subtitle={id}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate(`/playground/${id}`)}>
              ▶️ Test in Playground
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button>
            <Button variant="primary" onClick={save} disabled={!dirty || saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        }
      />

      {error && <ErrorBox message={error} />}

      {/* Identity */}
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Identity</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FieldGroup>
            <Label>Name</Label>
            <Input value={agent.name} onChange={(v) => update({ name: v })} placeholder="My Agent" />
          </FieldGroup>
          <FieldGroup>
            <Label>Version</Label>
            <Input value={agent.version} onChange={(v) => update({ version: v })} placeholder="1.0.0" />
          </FieldGroup>
        </div>
        <FieldGroup>
          <Label>Description</Label>
          <Input value={agent.description} onChange={(v) => update({ description: v })} placeholder="What this agent does..." />
        </FieldGroup>
      </Card>

      {/* System Prompt */}
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>System Prompt</h3>
        <TextArea
          value={agent.systemPrompt}
          onChange={(v) => update({ systemPrompt: v })}
          placeholder="You are a helpful assistant..."
          rows={12}
          mono
        />
      </Card>

      {/* Model */}
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Model</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FieldGroup>
            <Label>Provider</Label>
            <Select
              value={agent.model.provider}
              onChange={(v) => update({ model: { ...agent.model, provider: v, name: MODELS[v]?.[0] || "" } })}
              options={PROVIDERS}
            />
          </FieldGroup>
          <FieldGroup>
            <Label>Model</Label>
            <Select
              value={agent.model.name}
              onChange={(v) => update({ model: { ...agent.model, name: v } })}
              options={(MODELS[agent.model.provider] || []).map((m) => ({ value: m, label: m }))}
            />
          </FieldGroup>
          <FieldGroup>
            <Label>Temperature ({agent.model.temperature})</Label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={agent.model.temperature}
              onChange={(e) => update({ model: { ...agent.model, temperature: parseFloat(e.target.value) } })}
              style={{ width: "100%" }}
            />
          </FieldGroup>
          <FieldGroup>
            <Label>Max Tokens</Label>
            <Input
              value={String(agent.model.maxTokens)}
              onChange={(v) => update({ model: { ...agent.model, maxTokens: parseInt(v) || 4096 } })}
              type="number"
            />
          </FieldGroup>
        </div>
      </Card>

      {/* Context Write */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="checkbox"
            checked={agent.contextWrite}
            onChange={(e) => update({ contextWrite: e.target.checked })}
            style={{ width: 16, height: 16 }}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Context Write</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Automatically write this agent's output to context buckets
            </div>
          </div>
          {agent.contextWrite && <Badge variant="warning">✍️ Enabled</Badge>}
        </div>
      </Card>
    </div>
  );
}
