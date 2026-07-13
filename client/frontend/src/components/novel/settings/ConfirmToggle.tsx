// ConfirmToggle — a refined completion toggle for setting sections

interface ConfirmToggleProps {
  confirmed: boolean;
  onToggle: () => void;
}

export default function ConfirmToggle({ confirmed, onToggle }: ConfirmToggleProps) {
  return (
    <button
      onClick={onToggle}
      disabled={confirmed}
      className={`
        relative flex items-center gap-2.5 px-4 py-2 rounded-lg text-sm font-medium
        transition-all duration-300 group
        ${confirmed
          ? "bg-success/10 text-success cursor-default border border-success/20"
          : "bg-base-200/50 text-base-content/50 hover:text-primary border border-base-300/50 hover:border-primary/30 hover:bg-primary/5"
        }
      `}
    >
      {/* Checkmark circle */}
      <span className={`
        relative flex items-center justify-center w-5 h-5 rounded-full border-2
        transition-all duration-300
        ${confirmed
          ? "bg-success border-success text-white"
          : "border-base-content/20 group-hover:border-primary/40"
        }
      `}>
        {confirmed && (
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ strokeDasharray: 10, strokeDashoffset: 0 }}
            />
          </svg>
        )}
      </span>

      {/* Label */}
      <span>{confirmed ? "已完成" : "标记完成"}</span>

      {/* Subtle glow effect when confirmed */}
      {confirmed && (
        <span className="absolute inset-0 rounded-lg bg-success/5 animate-pulse pointer-events-none" style={{ animationDuration: "3s" }} />
      )}
    </button>
  );
}
