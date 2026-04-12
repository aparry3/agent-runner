"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface AgentSummary {
  id: string;
  name: string;
  description?: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [newId, setNewId] = useState("");

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then(setAgents)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim()) return;

    const defaultManifest = `id: ${newId}\nname: ${newId}\nkind: llm\n\nmodel:\n  provider: openai\n  name: gpt-4o\n\ninstruction: |\n  You are a helpful assistant.\n`;

    await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: newId, name: newId, manifest: defaultManifest }),
    });

    setNewId("");
    const updated = await fetch("/api/agents").then((r) => r.json());
    setAgents(updated);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Agents</h1>

      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="new-agent-id"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          className="bg-zinc-100 text-zinc-900 px-4 py-2 rounded text-sm font-medium hover:bg-zinc-200"
        >
          Create
        </button>
      </form>

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : agents.length === 0 ? (
        <p className="text-zinc-500">No agents yet. Create one above.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition-colors"
            >
              <div className="font-medium">{agent.name}</div>
              <div className="text-sm text-zinc-500">{agent.id}</div>
              {agent.description && (
                <div className="text-sm text-zinc-400 mt-1">{agent.description}</div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
