import React from "react";
import type { CSSProperties, ReactNode } from "react";

// ═══ Layout ═══

export function PageHeader({ title, subtitle, actions }: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</h1>
        {subtitle && <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
    </div>
  );
}

export function Card({ children, style, onClick }: {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 20,
        cursor: onClick ? "pointer" : undefined,
        transition: onClick ? "border-color 0.15s" : undefined,
        ...style,
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.borderColor = "var(--primary)")}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.borderColor = "var(--border)")}
    >
      {children}
    </div>
  );
}

// ═══ Controls ═══

export function Button({ children, variant = "default", size = "md", onClick, disabled, style }: {
  children: ReactNode;
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "sm" | "md";
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const colors = {
    default: { bg: "var(--bg-elevated)", hover: "var(--border)", text: "var(--text)" },
    primary: { bg: "var(--primary)", hover: "var(--primary-hover)", text: "#fff" },
    danger: { bg: "var(--error)", hover: "#dc2626", text: "#fff" },
    ghost: { bg: "transparent", hover: "var(--bg-elevated)", text: "var(--text-muted)" },
  };
  const c = colors[variant];
  const pad = size === "sm" ? "6px 12px" : "8px 16px";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: pad,
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        background: c.bg,
        color: c.text,
        fontSize: size === "sm" ? 12 : 14,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Input({ value, onChange, placeholder, style, type = "text" }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: CSSProperties;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: "8px 12px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        color: "var(--text)",
        fontSize: 14,
        outline: "none",
        width: "100%",
        fontFamily: "var(--font)",
        ...style,
      }}
    />
  );
}

export function TextArea({ value, onChange, placeholder, rows = 6, style, mono }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  style?: CSSProperties;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        padding: "8px 12px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        color: "var(--text)",
        fontSize: 13,
        outline: "none",
        width: "100%",
        resize: "vertical",
        fontFamily: mono ? "var(--font-mono)" : "var(--font)",
        lineHeight: 1.6,
        ...style,
      }}
    />
  );
}

export function Select({ value, onChange, options, style }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  style?: CSSProperties;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "8px 12px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        color: "var(--text)",
        fontSize: 14,
        outline: "none",
        fontFamily: "var(--font)",
        ...style,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ═══ Display ═══

export function Badge({ children, variant = "default" }: {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "primary";
}) {
  const colors = {
    default: { bg: "var(--bg-elevated)", text: "var(--text-muted)" },
    success: { bg: "#16432c", text: "var(--success)" },
    warning: { bg: "#422a06", text: "var(--warning)" },
    error: { bg: "#3c1111", text: "var(--error)" },
    primary: { bg: "#2e2b5f", text: "var(--primary)" },
  };
  const c = colors[variant];
  return (
    <span style={{
      padding: "2px 8px",
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      background: c.bg,
      color: c.text,
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, subtitle, action }: {
  icon: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 60,
      color: "var(--text-muted)",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>{title}</div>
      {subtitle && <div style={{ fontSize: 14, marginTop: 4 }}>{subtitle}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Spinner() {
  return <span style={{ color: "var(--text-muted)" }}>⏳ Loading...</span>;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{
      padding: 16,
      borderRadius: "var(--radius)",
      background: "#3c1111",
      border: "1px solid var(--error)",
      color: "var(--error)",
      fontSize: 14,
    }}>
      {message}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
      {children}
    </label>
  );
}

export function FieldGroup({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ marginBottom: 16, ...style }}>{children}</div>;
}

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre style={{
      padding: 12,
      borderRadius: "var(--radius)",
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      fontSize: 12,
      fontFamily: "var(--font-mono)",
      overflow: "auto",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      lineHeight: 1.6,
    }}>
      {children}
    </pre>
  );
}
