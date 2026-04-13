"use client";

import { useEffect, useState } from "react";

interface Provider {
  id: string;
  name: string;
  models: string[];
  configured: boolean;
}

export default function SettingsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProviders = async () => {
    const res = await fetch("/api/providers");
    const data = await res.json();
    setProviders(data);
    setLoading(false);
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const handleEdit = (provider: Provider) => {
    setEditingId(provider.id);
    setApiKey("");
    setBaseUrl("");
  };

  const handleSave = async () => {
    if (!editingId || !apiKey.trim()) return;
    setSaving(true);
    await fetch(`/api/providers/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || undefined,
      }),
    });
    setSaving(false);
    setEditingId(null);
    setApiKey("");
    setBaseUrl("");
    await loadProviders();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Remove API key for ${id}?`)) return;
    await fetch(`/api/providers/${id}`, { method: "DELETE" });
    await loadProviders();
  };

  if (loading) {
    return <p className="text-zinc-500">Loading...</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-zinc-400 text-sm mb-6">
        Configure API keys for LLM providers. Keys are stored in the database and used at runtime.
        Environment variables are used as fallback.
      </p>

      <h2 className="text-lg font-semibold mb-3">Providers</h2>

      <div className="flex flex-col gap-3">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className="border border-zinc-800 rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{provider.name}</div>
                <div className="text-sm text-zinc-500">
                  {provider.models.length > 0
                    ? provider.models.join(", ")
                    : "Custom models"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    provider.configured
                      ? "bg-green-900 text-green-300"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {provider.configured ? "Configured" : "Not configured"}
                </span>
                {provider.configured && (
                  <button
                    onClick={() => handleDelete(provider.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                )}
                <button
                  onClick={() => handleEdit(provider)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  {provider.configured ? "Update" : "Configure"}
                </button>
              </div>
            </div>

            {editingId === provider.id && (
              <div className="mt-3 flex flex-col gap-2">
                <input
                  type="password"
                  placeholder="API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Base URL (optional, for custom endpoints)"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving || !apiKey.trim()}
                    className="bg-zinc-100 text-zinc-900 px-4 py-2 rounded text-sm font-medium hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-zinc-400 px-4 py-2 text-sm hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
