import React, { useState } from "react";
import { useQuery, api } from "../hooks/useApi";
import { PageHeader, Card, Badge, EmptyState, Spinner, ErrorBox, Button, Input, Select, CodeBlock } from "../components/shared";

export function Logs() {
  const [filter, setFilter] = useState({ agentId: "", limit: "50" });
  const params: Record<string, string> = {};
  if (filter.agentId) params.agentId = filter.agentId;
  if (filter.limit) params.limit = filter.limit;

  const { data, loading, error, refetch } = useQuery<any>(`/logs?${new URLSearchParams(params).toString()}`);
  const logs = Array.isArray(data) ? data : data?.logs || [];

  const [selected, setSelected] = useState<any>(null);

  return (
    <div>
      <PageHeader
        title="Invocation Logs"
        subtitle={`${logs.length} entries`}
        actions={<Button onClick={refetch}>↻ Refresh</Button>}
      />

      {/* Filters */}
      <Card style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Agent ID</div>
          <Input value={filter.agentId} onChange={(v) => setFilter((f) => ({ ...f, agentId: v }))} placeholder="All agents" style={{ width: 200 }} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Limit</div>
          <Select value={filter.limit} onChange={(v) => setFilter((f) => ({ ...f, limit: v }))} options={[
            { value: "20", label: "20" },
            { value: "50", label: "50" },
            { value: "100", label: "100" },
          ]} />
        </div>
        <Button variant="primary" size="sm" onClick={refetch}>Apply</Button>
      </Card>

      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}

      {logs.length === 0 && !loading && (
        <EmptyState icon="📋" title="No logs" subtitle="Invoke an agent to see invocation logs here" />
      )}

      <div style={{ display: "flex", gap: 16 }}>
        {/* Log List */}
        <div style={{ width: 420, flexShrink: 0 }}>
          {logs.map((log: any) => (
            <Card
              key={log.id}
              onClick={() => setSelected(log)}
              style={{
                marginBottom: 8,
                borderColor: selected?.id === log.id ? "var(--primary)" : undefined,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <Badge variant="primary">{log.agentId}</Badge>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>{log.model}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {log.error && <Badge variant="error">ERROR</Badge>}
                  <Badge>{log.duration}ms</Badge>
                </div>
              </div>
              <div style={{ fontSize: 13, marginTop: 6, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {log.input}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                {new Date(log.timestamp).toLocaleString()} • {log.usage?.totalTokens ?? "?"} tokens
                {log.toolCalls?.length > 0 && ` • ${log.toolCalls.length} tools`}
              </div>
            </Card>
          ))}
        </div>

        {/* Log Detail */}
        {selected && (
          <div style={{ flex: 1 }}>
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Invocation Detail</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16, fontSize: 13 }}>
                <div><span style={{ color: "var(--text-muted)" }}>ID:</span> {selected.id}</div>
                <div><span style={{ color: "var(--text-muted)" }}>Agent:</span> {selected.agentId}</div>
                <div><span style={{ color: "var(--text-muted)" }}>Model:</span> {selected.model}</div>
                <div><span style={{ color: "var(--text-muted)" }}>Duration:</span> {selected.duration}ms</div>
                <div><span style={{ color: "var(--text-muted)" }}>Tokens:</span> {selected.usage?.promptTokens}↑ {selected.usage?.completionTokens}↓ ({selected.usage?.totalTokens} total)</div>
                <div><span style={{ color: "var(--text-muted)" }}>Time:</span> {new Date(selected.timestamp).toLocaleString()}</div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Input</div>
                <CodeBlock>{selected.input}</CodeBlock>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Output</div>
                <CodeBlock>{selected.output}</CodeBlock>
              </div>

              {selected.error && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginBottom: 4 }}>Error</div>
                  <CodeBlock>{selected.error}</CodeBlock>
                </div>
              )}

              {selected.toolCalls?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Tool Calls</div>
                  {selected.toolCalls.map((tc: any, i: number) => (
                    <details key={i} style={{ marginBottom: 4 }}>
                      <summary style={{ cursor: "pointer", fontSize: 13 }}>🔧 {tc.name} ({tc.duration}ms)</summary>
                      <CodeBlock>{JSON.stringify({ input: tc.input, output: tc.output }, null, 2)}</CodeBlock>
                    </details>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
