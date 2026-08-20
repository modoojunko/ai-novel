import { ChevronRight } from "lucide-react";
import type { WorkbenchVolume } from "@/hooks/useWorkbench";
import { nodeLabel } from "@/lib/nodeTitle";

interface BreadcrumbProps {
  projectName: string;
  volumes: WorkbenchVolume[];
  selectedId: string | null;
  selectedRef: string | null;
  onSelectVolume: (volumeName: string) => void;
  onSelectChapter: (ref: string) => void;
}

/** 解析 vol-{n}-ch-{m} → { volNum, chNum }；否则仅卷名。 */
function parseRef(ref: string): { volNum: number | null; chNum: number | null } {
  const m = ref.match(/^vol-(\d+)-ch-(\d+)$/);
  if (m) return { volNum: parseInt(m[1], 10), chNum: parseInt(m[2], 10) };
  const vm = ref.match(/^vol-(\d+)$/);
  if (vm) return { volNum: parseInt(vm[1], 10), chNum: null };
  return { volNum: null, chNum: null };
}

export default function Breadcrumb({
  projectName,
  volumes,
  selectedId,
  selectedRef,
  onSelectVolume,
  onSelectChapter,
}: BreadcrumbProps) {
  const active = parseRef(selectedRef ?? selectedId ?? "");

  const volTitle = (volName: string) => {
    const vol = volumes.find((v) => v.name === volName);
    const n = parseInt((volName || "").replace("vol-", ""), 10);
    if (!n) return volName;
    return nodeLabel("卷", n, vol?.title);
  };

  const selectedVolName = active.volNum !== null ? `vol-${active.volNum}` : null;
  const selectedChTitle = active.chNum !== null && selectedRef
    ? (() => {
        const vol = volumes.find((v) => v.name === `vol-${active.volNum}`);
        const ch = vol?.chapters?.find((c) => c.chapter === active.chNum);
        return nodeLabel("章", active.chNum!, ch?.title);
      })()
    : null;

  return (
    <div className="flex items-center gap-1 px-4 h-9 border-b border-base-300 bg-base-100/60 text-sm min-w-0">
      <span className="text-base-content/50 truncate">{projectName}</span>
      {selectedVolName && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-base-content/20 shrink-0" />
          <button
            onClick={() => onSelectVolume(selectedVolName)}
            className={`truncate ${
              !selectedRef ? "text-primary font-medium" : "text-base-content/70 hover:text-primary"
            }`}
            title="跳转到该卷"
          >
            {volTitle(selectedVolName)}
          </button>
        </>
      )}
      {selectedChTitle && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-base-content/20 shrink-0" />
          <button
            onClick={() => selectedRef && onSelectChapter(selectedRef)}
            className="text-primary font-medium truncate"
            title="跳转到该章"
          >
            {selectedChTitle}
          </button>
        </>
      )}
    </div>
  );
}
