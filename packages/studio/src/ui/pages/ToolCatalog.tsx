import React, { useState } from "react";
import { useQuery, api } from "../hooks/useApi";
import { PageHeader, Card, Badge, EmptyState, Spinner, ErrorBox, CodeBlock, Button, TextArea } from "../components/shared";

export function ToolCatalog() {
  const { data: tools, loading, error } = useQuery<any[]>("/tools");
  const [selected, setSelected] = useState<any | null>(null);
  const [testInput, setTestInput] = useState("{}");
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    if (!selected) return;
    setTesting(true);
    setTestResult(null);
    try {
      const input = JSON.parse(testInput);
      const result = await api.testTool(selected.name, input);
      setTestResult(result);
    } catch (e) {
      setTestResult({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Tool Catalog" subtitle={`${tools?.length ?? 0} tools available`} />
      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}

      {tools && tools.length === 0 && (
        <EmptyState icon="🔧" title="No tools registered" subtitle="Register tools via defineTool() in your code" />
      )}

      <div style={{ display: "flex", gap: 16 }}>
        {/* Tool List */}
        <div style={{ width: 300, flexShrink: 0 }}>
          {tools?.map((tool: any) => (
            <Card
              key={tool.name}
              onClick={() => {
                setSelected(tool);
                setTestResult(null);
                setTestInput(JSON.stringify(getDefaultInput(tool.inputSchema), null, 2));
              }}
              style={{
                marginBottom: 8,
                borderColor: selected?.name === tool.name ? "var(--primary)" : undefined,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{tool.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{tool.description}</div>
              <div style={{ marginTop: 6 }}>
                <Badge variant={tool.source === "inline" ? "primary" : "default"}>{tool.source}</Badge>
              </div>
            </Card>
          ))}
        </div>

        {/* Tool Detail */}
        {selected && (
          <div style={{ flex: 1 }}>
            <Card style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{selected.name}</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{selected.description}</p>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>Input Schema</div>
                <CodeBlock>{JSON.stringify(selected.inputSchema, null, 2)}</CodeBlock>
              </div>
            </Card>

            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Test Tool</h3>
              <TextArea value={testInput} onChange={setTestInput} rows={4} mono placeholder='{"key": "value"}' />
              <div style={{ marginTop: 8 }}>
                <Button variant="primary" onClick={handleTest} disabled={testing}>
                  {testing ? "Running..." : "▶️ Execute"}
                </Button>
              </div>
              {testResult && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>Result</div>
                  <CodeBlock>{JSON.stringify(testResult, null, 2)}</CodeBlock>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function getDefaultInput(schema: any): any {
  if (!schema?.properties) return {};
  const out: any = {};
  for (const [key, val] of Object.entries(schema.properties) as any) {
    if (val.type === "string") out[key] = "";
    else if (val.type === "number") out[key] = 0;
    else if (val.type === "boolean") out[key] = false;
  }
  return out;
}
