"use client";

import { useEffect, useState } from "react";

interface LogEntry {
  id: string;
  agentId: string;
  input: string;
  output: string;
  duration: number;
  model: string;
  timestamp: string;
  error?: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/logs")
      .then((r) => r.json())
      .then(setLogs)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Logs</h1>
      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-zinc-500">No invocation logs yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="border border-zinc-800 rounded-lg p-4"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-medium">{log.agentId}</span>
                <span className="text-sm text-zinc-500">
                  {log.duration}ms &middot; {log.model}
                </span>
              </div>
              <div className="text-sm text-zinc-400 truncate">
                Input: {log.input}
              </div>
              <div className="text-sm text-zinc-400 truncate">
                Output: {log.output}
              </div>
              {log.error && (
                <div className="text-sm text-red-400 mt-1">Error: {log.error}</div>
              )}
              <div className="text-xs text-zinc-600 mt-1">
                {new Date(log.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
