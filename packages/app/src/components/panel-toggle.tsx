"use client";

type PanelMode = "yaml" | "instruction" | "both";

interface PanelToggleProps {
  value: PanelMode;
  onChange: (mode: PanelMode) => void;
}

const options: { value: PanelMode; label: string }[] = [
  { value: "yaml", label: "YAML" },
  { value: "instruction", label: "Instruction" },
  { value: "both", label: "Both" },
];

export function PanelToggle({ value, onChange }: PanelToggleProps) {
  return (
    <div className="inline-flex rounded-lg bg-zinc-900 border border-zinc-700 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            value === opt.value
              ? "bg-zinc-700 text-zinc-100"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
