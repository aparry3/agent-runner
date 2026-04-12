"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

interface RunResult {
  output: unknown;
  state: Record<string, unknown>;
}

export default function PlaygroundPage() {
  const { id } = useParams<{ id: string }>();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: id, input }),
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "Unknown error");
      } else {
        setResult(body);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Playground</h1>
      <p className="text-sm text-zinc-400 mb-6">Agent: {id}</p>

      <form onSubmit={handleRun} className="mb-6">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter input (string or JSON)..."
          className="w-full h-32 bg-zinc-900 border border-zinc-700 rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:border-zinc-500 mb-3"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={running}
          className="bg-zinc-100 text-zinc-900 px-6 py-2 rounded text-sm font-medium hover:bg-zinc-200 disabled:opacity-50"
        >
          {running ? "Running..." : "Run"}
        </button>
      </form>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg p-4 mb-4">
          <div className="text-sm font-medium text-red-400 mb-1">Error</div>
          <pre className="text-sm text-red-300 whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-medium text-zinc-400 mb-2">Output</h2>
            <pre className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-sm whitespace-pre-wrap overflow-auto max-h-96">
              {typeof result.output === "string"
                ? result.output
                : JSON.stringify(result.output, null, 2)}
            </pre>
          </div>
          <div>
            <h2 className="text-sm font-medium text-zinc-400 mb-2">State</h2>
            <pre className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-sm whitespace-pre-wrap overflow-auto max-h-64">
              {JSON.stringify(result.state, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
