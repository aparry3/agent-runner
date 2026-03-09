import React, { useState } from "react";
import { useQuery, api } from "../hooks/useApi";
import { PageHeader, Card, Badge, EmptyState, Spinner, ErrorBox, Button, CodeBlock } from "../components/shared";

export function Sessions() {
  const { data: sessions, loading, error, refetch } = useQuery<any[]>("/sessions");
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[] | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const handleSelect = async (session: any) => {
    setSelected(session);
    setLoadingMsgs(true);
    try {
      const data = await api.getSession(session.id);
      setMessages(data.messages || data);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete session "${id}"?`)) return;
    await api.deleteSession(id);
    setSelected(null);
    setMessages(null);
    refetch();
  };

  return (
    <div>
      <PageHeader title="Sessions" subtitle={`${sessions?.length ?? 0} session${sessions?.length !== 1 ? "s" : ""}`} />
      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}

      {sessions && sessions.length === 0 && (
        <EmptyState icon="💬" title="No sessions" subtitle="Sessions are created when you invoke agents with a sessionId" />
      )}

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ width: 320, flexShrink: 0 }}>
          {sessions?.map((session: any) => (
            <Card
              key={session.id}
              onClick={() => handleSelect(session)}
              style={{
                marginBottom: 8,
                borderColor: selected?.id === session.id ? "var(--primary)" : undefined,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 600, fontSize: 13, fontFamily: "var(--font-mono)" }}>{session.id}</div>
                <Button variant="ghost" size="sm" onClick={(e: any) => { e.stopPropagation(); handleDelete(session.id); }}>🗑</Button>
              </div>
              {session.agentId && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  <Badge>{session.agentId}</Badge>
                  {session.messageCount && <span style={{ marginLeft: 8 }}>{session.messageCount} messages</span>}
                </div>
              )}
            </Card>
          ))}
        </div>

        {selected && (
          <div style={{ flex: 1 }}>
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                Session: {selected.id}
              </h3>
              {loadingMsgs && <Spinner />}
              {messages && messages.map((msg: any, i: number) => (
                <div key={i} style={{ marginBottom: 12, padding: 8, borderRadius: 6, background: msg.role === "user" ? "var(--bg-elevated)" : "transparent" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>
                    {msg.role}
                  </div>
                  <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{msg.content}</div>
                  {msg.toolCalls?.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      {msg.toolCalls.map((tc: any, j: number) => (
                        <Badge key={j}>🔧 {tc.name}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
