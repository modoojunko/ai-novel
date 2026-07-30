import { X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OnboardingCardProps {
  novelId: string;
  source: "ai" | "manual" | "import";
  variant: "empty-novel" | "imported-novel";
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Step configs
// ---------------------------------------------------------------------------

const EMPTY_NOVEL_STEPS = [
  { label: "设定", active: true },
  { label: "卷纲", active: false },
  { label: "章纲", active: false },
  { label: "提示词", active: false },
  { label: "写作", active: false },
  { label: "归档", active: false },
] as const;

const IMPORTED_NOVEL_STEPS = [
  { label: "设定", active: true },
  { label: "提示词", active: false },
  { label: "写作", active: false },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingCard({
  novelId: _novelId,
  source: _source,
  variant,
  onDismiss,
}: OnboardingCardProps) {
  const isImported = variant === "imported-novel";
  const steps = isImported ? IMPORTED_NOVEL_STEPS : EMPTY_NOVEL_STEPS;

  return (
    <div className="relative border-b border-primary/20 bg-gradient-to-r from-primary/[0.06] to-primary/[0.02] animate-fade-up">
      <div className="px-6 py-5">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 btn btn-ghost btn-xs btn-square"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <h3 className="font-serif font-semibold text-base-content text-lg mb-1">
          {isImported ? "稿子已导入！接下来补充设定" : "你的第一本书从设定开始"}
        </h3>

        {/* Description */}
        <p className="text-sm text-base-content/50 mb-5 max-w-lg leading-relaxed">
          {isImported
            ? "卷纲和章纲已由导入完成，补充设定后就能进入提示词和写作阶段。"
            : "按照六阶段创作流程，从设定开始，逐步完成卷纲、章纲、提示词、写作，最后归档。"}
        </p>

        {/* Mini timeline — daisyUI steps */}
        <div className="flex flex-wrap gap-x-1 mb-5">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`step text-xs before:!h-2 before:!w-2 ${step.active ? "step-primary" : ""}`}
            >
              {step.label}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button onClick={onDismiss} className="btn btn-primary btn-sm">
            {isImported ? "补充设定" : "开始设定"}
          </button>
          <button
            onClick={onDismiss}
            className="text-sm text-base-content/40 hover:text-base-content/60 transition-colors"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
