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

export default function PhaseProgress({ current }: { current: string }) {
  const cur = phaseIndex(current);

  return (
    <div className="flex items-center justify-center gap-0 py-2 px-4">
      {PHASES.map((p, i) => {
        const done = i < cur;
        const active = i === cur;
        return (
          <div key={p.key} className="flex items-center gap-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-3 h-3 rounded-full flex items-center justify-center transition-colors ${
                  done
                    ? "bg-success"
                    : active
                      ? "bg-primary shadow-[0_0_8px_hsl(var(--p))]"
                      : "bg-base-content/20 border border-base-content/15"
                }`}
              >
                {done && <Check className="w-2 h-2 text-success-content" />}
              </div>
              <span
                className={`text-[10px] whitespace-nowrap ${
                  active
                    ? "text-primary font-medium"
                    : done
                      ? "text-success/70"
                      : "text-base-content/30"
                }`}
              >
                {p.label}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div
                className={`w-6 h-[1.5px] mx-0.5 ${
                  i < cur ? "bg-success/60" : "bg-base-content/15"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
