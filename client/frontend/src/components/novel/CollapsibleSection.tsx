import { useState, type ReactNode } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

/** 右侧工具栏折叠节（原 RightToolbar 内 Section 抽出共享：卷/章工具面板复用） */
export default function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-base-200/80">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3.5 py-2.5 text-sm hover:bg-base-200/30 transition-colors"
      >
        <span className="flex items-center gap-2 font-medium text-base-content/80">
          {icon}
          {title}
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-base-content/30" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-base-content/30" />
        )}
      </button>
      {open && <div className="px-3.5 pb-3.5">{children}</div>}
    </div>
  );
}
