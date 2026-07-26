// ConfirmToggle — a refined completion toggle for setting sections

import { useState, useCallback } from "react";

interface ConfirmToggleProps {
  confirmed: boolean;
  onToggle: () => void;
}

export default function ConfirmToggle({ confirmed, onToggle }: ConfirmToggleProps) {
  const [animating, setAnimating] = useState(false);

  const handleClick = useCallback(() => {
    if (confirmed) return;
    setAnimating(true);
    onToggle();
    // Reset animation after transition completes
    setTimeout(() => setAnimating(false), 500);
  }, [confirmed, onToggle]);

  return (
    <button
      onClick={handleClick}
      disabled={confirmed}
      className={`
        relative flex items-center gap-2.5 px-4 py-2 rounded-lg text-sm font-medium
        transition-all duration-300 group select-none cursor-default
        ${confirmed
          ? "bg-success/10 text-success border border-success/20"
          : animating
            ? "bg-primary/10 text-primary border border-primary/30 scale-95"
            : "bg-base-200/50 text-base-content/50 hover:text-primary border border-base-300/50 hover:border-primary/30 hover:bg-primary/5"
        }
      `}
    >
      {/* Checkmark circle */}
      <span className={`
        relative flex items-center justify-center w-5 h-5 rounded-full border-2
        transition-all duration-300 shrink-0
        ${confirmed
          ? "bg-success border-success text-white"
          : animating
            ? "border-primary/50"
            : "border-base-content/20 group-hover:border-primary/40"
        }
      `}>
        {confirmed && (
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>

      {/* Label */}
      <span className="transition-all duration-200">
        {confirmed ? "已设定" : animating ? "保存中…" : "完成设定"}
      </span>

      {/* Subtle glow effect when confirmed */}
      {confirmed && (
        <span className="absolute inset-0 rounded-lg bg-success/5 animate-pulse pointer-events-none" style={{ animationDuration: "3s" }} />
      )}

      {/* Click pulse ripple */}
      {animating && (
        <span className="absolute inset-0 rounded-lg bg-primary/10 animate-ping pointer-events-none" style={{ animationDuration: "0.6s" }} />
      )}
    </button>
  );
}
