import { Check, Edit3, FileText } from "lucide-react";
import type { OutlineStatus } from "@/hooks/useOutline";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OutlineChapterCardProps {
  index: number;
  title: string;
  summary: string;
  status: OutlineStatus;
  hasPerspectiveGuidance: boolean;
  onEdit: () => void;
  onConfirm: () => void;
  onPerspective: () => void;
}

// ---------------------------------------------------------------------------
// Status display config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  OutlineStatus,
  { dot: string; badge: string; label: string }
> = {
  unfilled: {
    dot: "bg-gray-400",
    badge: "badge-ghost",
    label: "未填写",
  },
  in_progress: {
    dot: "bg-yellow-400",
    badge: "badge-warning",
    label: "填写中",
  },
  confirmed: {
    dot: "bg-green-500",
    badge: "badge-success",
    label: "已确认",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OutlineChapterCard({
  index,
  title,
  summary,
  status,
  hasPerspectiveGuidance,
  onEdit,
  onConfirm,
  onPerspective,
}: OutlineChapterCardProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-base-200/50 group transition-colors">
      {/* Status dot indicator */}
      <span
        className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`}
      />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-base-content/40 tabular-nums">
            {index}.
          </span>
          <span className="text-sm font-medium text-base-content truncate">
            {title || `第${index}章`}
          </span>
          <span className={`badge badge-sm ${config.badge}`}>
            {config.label}
          </span>
        </div>

        {/* Summary preview */}
        <p className="text-xs text-base-content/50 line-clamp-2 leading-relaxed ml-4">
          {summary || "暂未填写概要"}
        </p>
      </div>

      {/* Action buttons (visible on hover) */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="btn btn-ghost btn-xs gap-1 text-base-content/50 hover:text-primary"
          title="编辑章纲"
        >
          <Edit3 className="w-3.5 h-3.5" />
          编辑
        </button>
        <button
          onClick={onConfirm}
          disabled={status === "confirmed"}
          className={`btn btn-ghost btn-xs gap-1 ${
            status === "confirmed"
              ? "text-success/50 cursor-not-allowed"
              : "text-base-content/50 hover:text-success"
          }`}
          title={status === "confirmed" ? "已确认" : "确认章纲"}
        >
          <Check className="w-3.5 h-3.5" />
          {status === "confirmed" ? "已确认" : "确认"}
        </button>
        <button
          onClick={onPerspective}
          disabled={status !== "confirmed"}
          className={`btn btn-ghost btn-xs gap-1 ${
            status === "confirmed"
              ? "text-base-content/50 hover:text-primary"
              : "text-base-content/20 cursor-not-allowed"
          }`}
          title={
            status === "confirmed" ? "编辑视角引导" : "请先确认章纲"
          }
        >
          <FileText className="w-3.5 h-3.5" />
          视角
        </button>
      </div>
    </div>
  );
}
