"use client";

import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiSuggestButton({
  onClick,
  loading = false,
  label = "AI 建议",
  className = "",
}: {
  onClick?: () => void;
  loading?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium",
        "border border-primary/40 bg-card text-primary",
        "hover:border-primary/60 hover:bg-primary/8 hover:text-primary/90",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "transition-colors duration-200",
        className
      )}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Sparkles className="w-3 h-3" />
      )}
      {loading ? "生成中..." : label}
    </button>
  );
}
