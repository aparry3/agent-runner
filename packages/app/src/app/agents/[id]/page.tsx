"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AgentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [manifest, setManifest] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/agents/${id}`)
      .then((r) => r.json())
      .then((agent) => {
        setManifest(agent.metadata?.manifest ?? "");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifest }),
      });
      if (res.ok) {
        setStatus("Saved");
      } else {
        const body = await res.json();
        setStatus(`Error: ${body.error}`);
      }
    } catch (e) {
      setStatus(`Error: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete agent "${id}"?`)) return;
    await fetch(`/api/agents/${id}`, { method: "DELETE" });
    router.push("/agents");
  };

  if (loading) {
    return <p className="text-zinc-500">Loading...</p>;
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{id}</h1>
          <div className="flex gap-2 mt-1">
            <Link
              href={`/agents/${id}/playground`}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Playground
            </Link>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {status && (
            <span className={`text-sm ${status.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
              {status}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-zinc-100 text-zinc-900 px-4 py-2 rounded text-sm font-medium hover:bg-zinc-200 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={handleDelete}
            className="bg-red-900 text-red-100 px-4 py-2 rounded text-sm font-medium hover:bg-red-800"
          >
            Delete
          </button>
        </div>
      </div>

      <textarea
        value={manifest}
        onChange={(e) => setManifest(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "s") {
            e.preventDefault();
            handleSave();
          }
        }}
        className="w-full h-[calc(100vh-200px)] bg-zinc-900 border border-zinc-700 rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:border-zinc-500"
        spellCheck={false}
        placeholder="# Write your agent YAML manifest here..."
      />
    </div>
  );
}
