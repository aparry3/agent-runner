import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, api } from "../hooks/useApi";
import { PageHeader, Card, Button, Input, TextArea, Select, Label, FieldGroup, Badge, Spinner, CodeBlock } from "../components/shared";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: any[];
  usage?: any;
  duration?: number;
  model?: string;
}

export function Playground() {
  const { agentId: paramAgentId } = useParams();
  const { data: agents } = useQuery<any[]>("/agents");
  const [agentId, setAgentId] = useState(paramAgentId || "");
  const [sessionId, setSessionId] = useState("");
  const [contextIds, setContextIds] = useState("");
  const [toolContext, setToolContext] = useState("{}");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [invoking, setInvoking] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paramAgentId) setAgentId(paramAgentId);
  }, [paramAgentId]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInvoke = async () => {
    if (!agentId || !input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInvoking(true);

    try {
      const body: any = { input: userMsg };
      if (sessionId) body.sessionId = sessionId;
      if (contextIds) body.contextIds = contextIds.split(",").map((s: string) => s.trim()).filter(Boolean);
      try {
        const tc = JSON.parse(toolContext);
        if (Object.keys(tc).length > 0) body.toolContext = tc;
      } catch {}

      const result = await api.invokeAgent(agentId, body);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.output,
          toolCalls: result.toolCalls,
          usage: result.usage,
          duration: result.duration,
          model: result.model,
        },
      ]);

      // Auto-set session ID from result if available
      if (!sessionId && result.sessionId) setSessionId(result.sessionId);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ Error: ${e instanceof Error ? e.message : String(e)}` },
      ]);
    } finally {
      setInvoking(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSessionId("");
  };

  return (
    <div style={{ display: "flex", gap: 20, height: "calc(100vh - 72px)" }}>
      {/* Chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <PageHeader
          title="Playground"
          actions={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {agents && (
                <Select
                  value={agentId}
                  onChange={setAgentId}
                  options={[
                    { value: "", label: "Select agent..." },
                    ...(agents?.map((a: any) => ({ value: a.id, label: a.name || a.id })) || []),
                  ]}
                />
              )}
              <Button onClick={clearChat}>🗑 Clear</Button>
            </div>
          }
        />

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 16,
            background: "var(--bg-surface)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            marginBottom: 12,
          }}
        >
          {messages.length === 0 && (
            <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>
              Select an agent and start a conversation
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                marginBottom: 16,
                display: "flex",
                flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: msg.role === "user" ? "var(--primary)" : "var(--bg-elevated)",
                  color: msg.role === "user" ? "#fff" : "var(--text)",
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.content}
              </div>
              {msg.role === "assistant" && (msg.toolCalls?.length || msg.usage) && (
                <div style={{ display: "flex", gap: 6, marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                  {msg.model && <span>{msg.model}</span>}
                  {msg.usage && <span>• {msg.usage.totalTokens} tokens</span>}
                  {msg.duration && <span>• {(msg.duration / 1000).toFixed(1)}s</span>}
                  {msg.toolCalls?.length ? (
                    <span>• {msg.toolCalls.length} tool call{msg.toolCalls.length !== 1 ? "s" : ""}</span>
                  ) : null}
                </div>
              )}
              {msg.toolCalls?.length ? (
                <div style={{ maxWidth: "80%", marginTop: 4 }}>
                  {msg.toolCalls.map((tc: any, j: number) => (
                    <details key={j} style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      <summary style={{ cursor: "pointer" }}>🔧 {tc.name} ({tc.duration}ms)</summary>
                      <CodeBlock>{JSON.stringify({ input: tc.input, output: tc.output }, null, 2)}</CodeBlock>
                    </details>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          <div ref={messagesEnd} />
        </div>

        {/* Input */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleInvoke(); } }}
            placeholder={agentId ? `Message ${agentId}...` : "Select an agent first"}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text)",
              fontSize: 14,
              outline: "none",
              fontFamily: "var(--font)",
            }}
          />
          <Button variant="primary" onClick={handleInvoke} disabled={!agentId || !input.trim() || invoking}>
            {invoking ? "⏳" : "▶️"} Send
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Settings</h3>
          <FieldGroup>
            <Label>Session ID</Label>
            <Input value={sessionId} onChange={setSessionId} placeholder="auto-generated" />
          </FieldGroup>
          <FieldGroup>
            <Label>Context IDs (comma-separated)</Label>
            <Input value={contextIds} onChange={setContextIds} placeholder="users/1, global/data" />
          </FieldGroup>

          <Button variant="ghost" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} style={{ marginBottom: 8 }}>
            {showAdvanced ? "▼" : "▶"} Advanced
          </Button>

          {showAdvanced && (
            <FieldGroup>
              <Label>Tool Context (JSON)</Label>
              <TextArea value={toolContext} onChange={setToolContext} rows={4} mono placeholder='{"user": {"id": "1"}}' />
            </FieldGroup>
          )}
        </Card>
      </div>
    </div>
  );
}
