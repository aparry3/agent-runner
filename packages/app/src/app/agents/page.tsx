"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface AgentSummary {
  id: string;
  name: string;
  description?: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AgentSummary | null>(null);

  const loadAgents = () => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then(setAgents)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/agents/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    loadAgents();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Agents</h1>
        <Link
          href="/agents/new"
          className="bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors"
        >
          New Agent
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-zinc-500">Loading agents...</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-zinc-300 mb-2">No agents yet</h2>
          <p className="text-sm text-zinc-500 mb-4">Create your first agent to get started.</p>
          <Link
            href="/agents/new"
            className="bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Create your first agent
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div key={agent.id} className="group relative">
              <Link
                href={`/agents/${agent.id}`}
                className="block border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition-colors h-full"
              >
                <div className="font-medium text-zinc-100">{agent.name}</div>
                <div className="text-xs text-zinc-500 font-mono mt-1">{agent.id}</div>
                {agent.description && (
                  <div className="text-sm text-zinc-400 mt-2 line-clamp-2">
                    {agent.description}
                  </div>
                )}
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDeleteTarget(agent);
                }}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-all"
                title="Delete agent"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Agent"
        message={`Are you sure you want to delete "${deleteTarget?.name ?? deleteTarget?.id}"? All versions will be permanently removed.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
