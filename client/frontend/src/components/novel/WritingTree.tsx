import { useMemo } from "react";
import { Book, FileText, Plus } from "lucide-react";
import StructureTree from "./StructureTree";
import type { TreeNode } from "./StructureTree";
import type { WorkbenchVolume } from "@/hooks/useWorkbench";

interface WritingTreeProps {
  volumes: WorkbenchVolume[];
  selectedId: string | null;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectNode: (node: TreeNode) => void;
  onCreateVolume: () => void;
  onCreateChapter: () => void;
  onRename: (nodeId: string, newTitle: string) => void;
  onDelete: (nodeId: string) => void;
  onAddChapterIn: (volumeName: string) => void;
  onShowVersion?: (chapterRef: string) => void;
}

export default function WritingTree({
  volumes,
  selectedId,
  expandedIds,
  onToggle,
  onSelectNode,
  onCreateVolume,
  onCreateChapter,
  onRename,
  onDelete,
  onAddChapterIn,
  onShowVersion,
}: WritingTreeProps) {
  const nodes: TreeNode[] = useMemo(() => {
    return volumes.map((v) => {
      const volNum = parseInt((v.name || "").replace("vol-", ""), 10) || 0;
      const chapterNodes: TreeNode[] = (v.chapters || []).map((ch) => {
        const ref = `vol-${volNum}-ch-${ch.chapter}`;
        const hasProse = ch.has_prose ?? ch.word_count > 0;
        const isArchived = ch.archived ?? ch.status === "archived";
        const isEmpty = !hasProse && ref !== selectedId;
        return {
          id: ref,
          icon: <FileText className="w-3.5 h-3.5" />,
          label: ch.title || `第${ch.chapter}章`,
          // N1：空章「未写」弱化（灰字），不做硬过滤
          badge: isArchived
            ? "📦"
            : hasProse
              ? `${ch.word_count}字`
              : isEmpty
                ? "未写"
                : undefined,
          badgeColor: isEmpty ? "var(--wa)" : undefined,
          // 空章弱化样式（N1）：灰字 + 低透明度，但仍在树中可见
          data: { type: "chapter", ref, volume: v.name, chapter: ch.chapter },
          actions: [
            ...(onShowVersion
              ? [
                  {
                    icon: <FileText className="w-3 h-3" />,
                    label: "版本历史",
                    onClick: (node: TreeNode) => onShowVersion(node.id),
                  },
                ]
              : []),
          ],
        };
      });

      return {
        id: v.name || `vol-${volNum}`,
        icon: <Book className="w-3.5 h-3.5" />,
        label: v.title || `第${volNum}卷`,
        badge: `${chapterNodes.length}章`,
        children: chapterNodes,
        data: { type: "volume", volume: v.name, volNum },
      };
    });
  }, [volumes, selectedId, onShowVersion]);

  return (
    <div className="flex flex-col h-full">
      {/* 常驻「+ 新建卷」「+ 新建章」（N1） */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-base-300/50">
        <button
          onClick={onCreateVolume}
          className="btn btn-ghost btn-xs gap-1 text-base-content/60 hover:text-base-content flex-1"
          title="新建卷"
        >
          <Plus className="w-3.5 h-3.5" />
          新建卷
        </button>
        <button
          onClick={onCreateChapter}
          className="btn btn-ghost btn-xs gap-1 text-base-content/60 hover:text-base-content flex-1"
          title="新建章"
        >
          <Plus className="w-3.5 h-3.5" />
          新建章
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        <StructureTree
          nodes={nodes}
          selectedId={selectedId ?? undefined}
          onSelect={onSelectNode}
          expandedIds={expandedIds}
          onToggle={onToggle}
          editable
          onTitleChange={onRename}
          onDelete={onDelete}
          onAddChild={(node) => {
            const data = node.data as { type?: string; volume?: string } | undefined;
            if (data?.type === "volume" && data.volume) onAddChapterIn(data.volume);
          }}
        />
      </div>
    </div>
  );
}
