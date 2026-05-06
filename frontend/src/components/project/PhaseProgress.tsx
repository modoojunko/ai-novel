"use client";

import { Check } from "lucide-react";

const PHASES = [
  { key: "init", label: "初始化" },
  { key: "settings", label: "设定" },
  { key: "outline", label: "大纲" },
  { key: "prompts", label: "提示词" },
  { key: "write", label: "写作" },
  { key: "archives", label: "存档" },
] as const;

function phaseIndex(key: string): number {
  return PHASES.findIndex((p) => p.key === key);
}

export function PhaseProgress({ current }: { current: string }) {
  const curIdx = phaseIndex(current);

  return (
    <div className="flex items-center justify-center gap-0 py-2 px-4">
      {PHASES.map((p, i) => {
        const isDone = i < curIdx;
        const isCurrent = i === curIdx;
        return (
          <div key={p.key} className="flex items-center gap-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-3 h-3 rounded-full flex items-center justify-center transition-colors ${
                  isDone
                    ? "bg-emerald-600"
                    : isCurrent
                      ? "bg-primary shadow-[0_0_8px_var(--primary)]"
                      : "bg-muted-foreground/30 border border-muted-foreground/20"
                }`}
              >
                {isDone && <Check className="w-2 h-2 text-white" />}
              </div>
              <span
                className={`text-[10px] whitespace-nowrap ${
                  isCurrent
                    ? "text-primary font-medium"
                    : isDone
                      ? "text-emerald-600/70"
                      : "text-muted-foreground/40"
                }`}
              >
                {p.label}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div
                className={`w-6 h-[1.5px] mx-0.5 ${
                  i < curIdx ? "bg-emerald-600/60" : "bg-muted-foreground/20"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
