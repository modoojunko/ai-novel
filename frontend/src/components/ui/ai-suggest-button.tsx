import { Loader2, Sparkles } from "lucide-react";

export default function AiSuggestButton({
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
      className={`btn btn-xs btn-outline btn-primary gap-1 ${loading ? "btn-disabled" : ""} ${className}`}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      {loading ? "生成中..." : label}
    </button>
  );
}
