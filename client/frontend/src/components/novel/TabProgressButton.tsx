import { Check, CircleDashed } from "lucide-react";
import type { ReactNode } from "react";

type PhaseStatus = 'complete' | 'in_progress' | 'skipped' | 'pending';

interface TabProgressButtonProps {
  label: string;
  icon?: ReactNode;
  status?: PhaseStatus;
  active: boolean;
  onClick: () => void;
  children?: ReactNode;
}

export default function TabProgressButton({
  label,
  icon,
  status,
  active,
  onClick,
  children,
}: TabProgressButtonProps) {
  const renderIndicator = () => {
    if (!status || status === 'pending') return null;
    switch (status) {
      case 'complete':
        return <Check className="w-3 h-3" />;
      case 'in_progress':
        return (
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
        );
      case 'skipped':
        return <CircleDashed className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const statusClass = () => {
    if (active) return '';
    if (!status || status === 'pending') return 'text-base-content/60';
    switch (status) {
      case 'complete': return 'text-success';
      case 'in_progress': return 'text-primary font-bold';
      case 'skipped': return 'text-warning/60';
      default: return '';
    }
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1 ${
        active
          ? "bg-base-300 text-base-content font-medium"
          : `${statusClass()} hover:text-base-content hover:bg-base-300/40`
      }`}
    >
      {status === 'in_progress' && !active && renderIndicator()}
      {icon && <span className="w-3.5 h-3.5 shrink-0">{icon}</span>}
      {label}
      {status !== 'in_progress' && renderIndicator()}
      {children}
    </button>
  );
}
