import React, { useState } from "react";
import { useQuery, api } from "../hooks/useApi";
import { PageHeader, Card, Badge, EmptyState, Spinner, ErrorBox, Button, Input, TextArea, Label, FieldGroup, CodeBlock } from "../components/shared";

export function ContextBrowser() {
  const { data: contexts, loading, error, refetch } = useQuery<any[]>("/context");
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newId, setNewId] = useState("");
  const [newContent, setNewContent] = useState("");

  const handleSelect = async (ctx: any) => {
    setSelected(ctx);
    setLoadingDetail(true);
    try {
      const data = await api.getContext(ctx.contextId || ctx.id);
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreate = async () => {
    if (!newId.trim() || !newContent.trim()) return;
    await api.putContext(newId.trim(), { content: newContent, agentId: "studio", invocationId: "manual" });
    setShowCreate(false);
    setNewId("");
    setNewContent("");
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete context "${id}"?`)) return;
    await api.deleteContext(id);
    if (selected?.contextId === id || selected?.id === id) {
      setSelected(null);
      setDetail(null);
    }
    refetch();
  };

  return (
    <div>
      <PageHeader
        title="Context Browser"
        subtitle={`${contexts?.length ?? 0} context bucket${contexts?.length !== 1 ? "s" : ""}`}
        actions={<Button variant="primary" onClick={() => setShowCreate(true)}>+ New Context</Button>}
      />

      {showCreate && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Create Context</h3>
          <FieldGroup>
            <Label>Context ID</Label>
            <Input value={newId} onChange={setNewId} placeholder="users/1/fitness" />
          </FieldGroup>
          <FieldGroup>
            <Label>Content</Label>
            <TextArea value={newContent} onChange={setNewContent} rows={4} placeholder="Initial context content..." />
          </FieldGroup>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" onClick={handleCreate} disabled={!newId.trim() || !newContent.trim()}>Create</Button>
            <Button onClick={() => { setShowCreate(false); setNewId(""); setNewContent(""); }}>Cancel</Button>
          </div>
        </Card>
      )}

      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}

      {contexts && contexts.length === 0 && !loading && (
        <EmptyState
          icon="📦"
          title="No context buckets"
          subtitle="Context is created when agents write to it, or manually via the API"
          action={<Button variant="primary" onClick={() => setShowCreate(true)}>+ Create Context</Button>}
        />
      )}

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ width: 320, flexShrink: 0 }}>
          {contexts?.map((ctx: any) => {
            const id = ctx.contextId || ctx.id;
            return (
              <Card
                key={id}
                onClick={() => handleSelect(ctx)}
                style={{
                  marginBottom: 8,
                  borderColor: (selected?.contextId || selected?.id) === id ? "var(--primary)" : undefined,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, fontFamily: "var(--font-mono)" }}>{id}</div>
                  <Button variant="ghost" size="sm" onClick={(e: any) => { e.stopPropagation(); handleDelete(id); }}>🗑</Button>
                </div>
                {ctx.entryCount != null && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    {ctx.entryCount} entries
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {selected && (
          <div style={{ flex: 1 }}>
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                Context: {selected.contextId || selected.id}
              </h3>
              {loadingDetail && <Spinner />}
              {detail && (
                Array.isArray(detail) ? detail : (detail.entries || [detail])
              ).map((entry: any, i: number) => (
                <div key={i} style={{ marginBottom: 12, padding: 12, background: "var(--bg-elevated)", borderRadius: 6 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 11, color: "var(--text-muted)" }}>
                    {entry.agentId && <Badge>{entry.agentId}</Badge>}
                    {entry.createdAt && <span>{new Date(entry.createdAt).toLocaleString()}</span>}
                  </div>
                  <div style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {entry.content}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
