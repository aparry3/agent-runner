import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, api } from "../hooks/useApi";
import { PageHeader, Card, Button, Badge, EmptyState, Spinner, ErrorBox, Input } from "../components/shared";

export function Agents() {
  const { data: agents, loading, error, refetch } = useQuery<any[]>("/agents");
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [newId, setNewId] = useState("");

  const handleCreate = async () => {
    if (!newId.trim()) return;
    const id = newId.trim().toLowerCase().replace(/\s+/g, "-");
    await api.putAgent(id, {
      name: id.charAt(0).toUpperCase() + id.slice(1),
      systemPrompt: "You are a helpful assistant.",
      model: { provider: "openai", name: "gpt-4o-mini" },
    });
    setShowCreate(false);
    setNewId("");
    navigate(`/agents/${id}`);
  };

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle={`${agents?.length ?? 0} agent${agents?.length !== 1 ? "s" : ""} defined`}
        actions={
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            + New Agent
          </Button>
        }
      />

      {showCreate && (
        <Card style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
          <Input
            value={newId}
            onChange={setNewId}
            placeholder="Agent ID (e.g., code-reviewer)"
            style={{ flex: 1 }}
          />
          <Button variant="primary" onClick={handleCreate} disabled={!newId.trim()}>
            Create
          </Button>
          <Button onClick={() => { setShowCreate(false); setNewId(""); }}>Cancel</Button>
        </Card>
      )}

      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}

      {agents && agents.length === 0 && (
        <EmptyState
          icon="🤖"
          title="No agents yet"
          subtitle="Create your first agent to get started"
          action={<Button variant="primary" onClick={() => setShowCreate(true)}>+ New Agent</Button>}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
        {agents?.map((agent: any) => (
          <Card key={agent.id} onClick={() => navigate(`/agents/${agent.id}`)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{agent.name || agent.id}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                  {agent.id}
                </div>
              </div>
              <Badge variant="primary">{agent.model?.provider ?? "?"}/{agent.model?.name ?? "?"}</Badge>
            </div>
            {agent.description && (
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
                {agent.description}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {agent.tools?.length > 0 && <Badge>🔧 {agent.tools.length} tool{agent.tools.length !== 1 ? "s" : ""}</Badge>}
              {agent.contextWrite && <Badge variant="warning">✍️ writes context</Badge>}
              {agent.eval?.testCases?.length > 0 && <Badge variant="success">🧪 {agent.eval.testCases.length} tests</Badge>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
