import React from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { Agents } from "./pages/Agents";
import { AgentEditor } from "./pages/AgentEditor";
import { ToolCatalog } from "./pages/ToolCatalog";
import { Playground } from "./pages/Playground";
import { Sessions } from "./pages/Sessions";
import { Logs } from "./pages/Logs";
import { ContextBrowser } from "./pages/ContextBrowser";

const NAV_ITEMS = [
  { to: "/agents", label: "Agents", icon: "🤖" },
  { to: "/tools", label: "Tools", icon: "🔧" },
  { to: "/playground", label: "Playground", icon: "▶️" },
  { to: "/sessions", label: "Sessions", icon: "💬" },
  { to: "/context", label: "Context", icon: "📦" },
  { to: "/logs", label: "Logs", icon: "📋" },
];

export function App() {
  return (
    <BrowserRouter>
      <div style={{ display: "flex", minHeight: "100vh", width: "100%" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: "24px 32px", overflow: "auto" }}>
          <Routes>
            <Route path="/" element={<Navigate to="/agents" replace />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/agents/:id" element={<AgentEditor />} />
            <Route path="/tools" element={<ToolCatalog />} />
            <Route path="/playground" element={<Playground />} />
            <Route path="/playground/:agentId" element={<Playground />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/context" element={<ContextBrowser />} />
            <Route path="/logs" element={<Logs />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function Sidebar() {
  return (
    <nav
      style={{
        width: 220,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        padding: "20px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          padding: "8px 12px 20px",
          color: "var(--primary)",
          letterSpacing: "-0.02em",
        }}
      >
        ⚡ agent-runner
      </div>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          style={({ isActive }) => ({
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: "var(--radius)",
            textDecoration: "none",
            color: isActive ? "var(--text)" : "var(--text-muted)",
            background: isActive ? "var(--bg-elevated)" : "transparent",
            fontSize: 14,
            fontWeight: isActive ? 600 : 400,
            transition: "all 0.15s",
          })}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-muted)" }}>
        agent-runner v0.1.0
      </div>
    </nav>
  );
}
