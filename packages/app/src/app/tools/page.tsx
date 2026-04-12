"use client";

import { useEffect, useState } from "react";

interface ToolInfo {
  name: string;
  description: string;
  source: string;
  inputSchema: Record<string, unknown>;
}

export default function ToolsPage() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tools")
      .then((r) => r.json())
      .then(setTools)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Tools</h1>
      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : tools.length === 0 ? (
        <p className="text-zinc-500">No tools registered.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tools.map((tool) => (
            <div
              key={tool.name}
              className="border border-zinc-800 rounded-lg p-4"
            >
              <div className="font-medium font-mono text-sm">{tool.name}</div>
              <div className="text-sm text-zinc-400">{tool.description}</div>
              <div className="text-xs text-zinc-600 mt-1">Source: {tool.source}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
