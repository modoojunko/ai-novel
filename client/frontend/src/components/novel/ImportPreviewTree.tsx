import { useState, useCallback, useMemo } from "react";
import { Ico, P } from "@/components/icons";
import StructureTree, { TreeNode } from "./StructureTree";
import type { VolumeImportData } from "@/lib/api";
import { cnNum } from "@/lib/nodeTitle";

interface ImportPreviewTreeProps {
  /** Novel title shown in the header */
  title?: string;
  volumes: VolumeImportData[];
  onVolumesChange: (volumes: VolumeImportData[]) => void;
  onConfirm: () => void;
  onBack: () => void;
  loading?: boolean;
  /** Reset volumes to the original parsed structure */
  onReset?: () => void;
}

// ---------------------------------------------------------------------------
// Helper — build TreeNode[] from VolumeImportData[]
// ---------------------------------------------------------------------------

function buildTreeNodes(volumes: VolumeImportData[]): TreeNode[] {
  return volumes.map((vol, vi) => ({
    id: `vol-${vi}`,
    // 兜底序号与树列口径统一（中文数字，spec-review 轻微 #1）
    label: vol.title || `第${cnNum(vi + 1)}卷`,
    icon: <Ico d={P.doc} size={12} />,
    children: vol.chapters.map((ch, ci) => ({
      id: `ch-${vi}-${ci}`,
      label: ch.title || `第${cnNum(ci + 1)}章`,
      locked: true,
      badge: ch.word_count ? `${ch.word_count} 字` : undefined,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImportPreviewTree({
  title,
  volumes,
  onVolumesChange,
  onConfirm,
  onBack,
  loading,
  onReset,
}: ImportPreviewTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // All volumes expanded by default
    return new Set(volumes.map((_, i) => `vol-${i}`));
  });
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const nodes = useMemo(() => buildTreeNodes(volumes), [volumes]);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback((node: TreeNode) => {
    setSelectedId(node.id);
  }, []);

  const handleTitleChange = useCallback(
    (nodeId: string, newTitle: string) => {
      const next = volumes.map((vol, vi) => {
        if (nodeId === `vol-${vi}`) {
          return { ...vol, title: newTitle };
        }
        return {
          ...vol,
          chapters: vol.chapters.map((ch, ci) => {
            if (nodeId === `ch-${vi}-${ci}`) {
              return { ...ch, title: newTitle };
            }
            return ch;
          }),
        };
      });
      onVolumesChange(next);
    },
    [volumes, onVolumesChange],
  );

  const handleDelete = useCallback(
    (nodeId: string) => {
      const match = nodeId.match(/^ch-(\d+)-(\d+)$/);
      if (!match) return; // only chapter deletion is supported
      const vi = parseInt(match[1], 10);
      const ci = parseInt(match[2], 10);
      const next = volumes.map((vol, i) => {
        if (i !== vi) return vol;
        return {
          ...vol,
          chapters: vol.chapters.filter((_, j) => j !== ci),
        };
      });
      onVolumesChange(next);
    },
    [volumes, onVolumesChange],
  );

  const totalChapters = volumes.reduce((s, v) => s + v.chapters.length, 0);
  // 导入场景作者最关心总字数（spec-review #2）
  const totalWords = volumes.reduce(
    (s, v) => s + v.chapters.reduce((a, c) => a + (c.word_count ?? 0), 0),
    0,
  );

  // ---- Render ----

  return (
    <div className="space-y-4">
      {/* Title header */}
      <div className="flex items-center gap-2">
        <Ico d={P.doc} size={18} style={{ color: "var(--accent)" }} />
        <h4 className="font-semibold text-base">{title || "导入预览"}</h4>
      </div>

      {/* Editable tree */}
      <div
        className="rounded-lg p-3 max-h-64 overflow-y-auto"
        style={{ background: "var(--fg-soft)", border: "1px solid var(--border)" }}
      >
        <StructureTree
          nodes={nodes}
          selectedId={selectedId}
          onSelect={handleSelect}
          expandedIds={expandedIds}
          onToggle={handleToggle}
          editable
          locked
          onTitleChange={handleTitleChange}
          onDelete={handleDelete}
        />
      </div>

      {/* Stats */}
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        共 {totalChapters} 章节 · {totalWords.toLocaleString("zh-CN")} 字
      </p>

      {/* Reset link */}
      {onReset && (
        <div className="text-center">
          <button className="lnk text-xs" onClick={onReset}>
            重置为原始结构
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 justify-end pt-2">
        <button
          className="btn btn-ghost btn-sm"
          onClick={onBack}
          disabled={loading}
        >
          返回修改
        </button>
        <button
          className="btn btn-primary"
          onClick={onConfirm}
          disabled={loading || totalChapters === 0}
        >
          {loading ? (
            <>
              <Ico d={P.spinner} className="spin" size={14} />
              入库中…
            </>
          ) : (
            "确认入库"
          )}
        </button>
      </div>
    </div>
  );
}
