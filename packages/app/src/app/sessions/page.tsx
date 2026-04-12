"use client";

import { useEffect, useState } from "react";

interface Session {
  sessionId: string;
  agentId?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Sessions</h1>
      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : sessions.length === 0 ? (
        <p className="text-zinc-500">No sessions yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <div
              key={s.sessionId}
              className="border border-zinc-800 rounded-lg p-4"
            >
              <div className="font-mono text-sm">{s.sessionId}</div>
              {s.agentId && (
                <div className="text-sm text-zinc-400">Agent: {s.agentId}</div>
              )}
              <div className="text-sm text-zinc-500">
                {s.messageCount} messages &middot; {new Date(s.updatedAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
