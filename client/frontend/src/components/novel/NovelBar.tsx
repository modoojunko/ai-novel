import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useTier } from "@/hooks/useTier";
import {
  Archive,
  ChevronDown,
  Pencil,
  Settings,
  ListTree,
  Trash2,
} from "lucide-react";
import { useProject } from "@/hooks/useProject";

interface NovelBarProps {
  onGoAdvancedSettings: () => void;
  onGoAdvancedOutline: () => void;
  onGoArchives: () => void;
  onDelete: () => void;
}

export default function NovelBar({
  onGoAdvancedSettings,
  onGoAdvancedOutline,
  onGoArchives,
  onDelete,
}: NovelBarProps) {
  const { project, updateProject } = useProject();
  const { tier, isFree } = useTier();

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const nameSavedRef = useRef(false); // 防 Enter 保存后 blur 再触发双保存

  // 顶栏书名就地编辑：blur/Enter 保存，Esc 取消（savedRef 防双保存竞态）
  const saveName = useCallback(async () => {
    const next = nameDraft.trim();
    if (nameSavedRef.current) {
      nameSavedRef.current = false;
      return;
    }
    nameSavedRef.current = true;
    setEditingName(false);
    if (!project?.id || !next || next === project.name) return;
    try {
      const updated = await api.renameNovel(project.id, next);
      updateProject({ name: updated.name });
      toast.success(`已更名为《${updated.name}》`);
    } catch {
      toast.error("改名失败");
    }
  }, [nameDraft, project, updateProject]);

  const typeLabel = project?.type || project?.genre || "";

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-base-300 bg-base-200/50">
      {/* Project name (inline rename) + type */}
      <div className="min-w-0 flex items-center gap-2">
        {editingName ? (
          <input
            className="input input-sm input-bordered w-36 font-serif text-base-content"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") {
                nameSavedRef.current = true;
                setNameDraft(project?.name ?? "");
                setEditingName(false);
              }
            }}
            maxLength={60}
            autoFocus
            aria-label="小说书名"
          />
        ) : (
          <button
            className="group/name flex items-center gap-1.5 max-w-full"
            onClick={() => {
              setNameDraft(project?.name ?? "");
              setEditingName(true);
            }}
            title="点击修改书名"
            aria-label="点击修改书名"
          >
            <h1 className="text-lg font-bold font-serif text-base-content truncate max-w-[30vw] group-hover/name:text-primary transition-colors">
              {project?.name ?? "…"}
            </h1>
            <Pencil className="w-3.5 h-3.5 text-base-content/30 group-hover/name:text-base-content/70 transition-colors shrink-0" />
          </button>
        )}
        {typeLabel && (
          <span className="badge badge-ghost badge-sm hidden sm:inline-flex">
            {typeLabel}
          </span>
        )}
      </div>

      {/* Free / PRO hint */}
      <div className="flex items-center gap-1">
        {isFree ? (
          <span className="badge badge-outline badge-sm text-base-content/60">
            免费 · 完整人工写作（限 1 部作品）
          </span>
        ) : (
          <span className="badge badge-primary badge-sm">PRO · {tier}</span>
        )}
      </div>

      {/* 高级配置 ▾ + 归档 + 删除 */}
      <div className="flex items-center gap-1">
        <div className="dropdown dropdown-end">
          <button
            tabIndex={0}
            className="btn btn-ghost btn-sm gap-1 text-base-content/70 hover:text-base-content"
            title="高级配置（设定/大纲）"
            aria-label="高级配置"
          >
            <Settings className="w-4 h-4" />
            高级配置
            <ChevronDown className="w-3 h-3" />
            {isFree && (
              <span className="badge badge-warning badge-xs font-normal">可选</span>
            )}
          </button>
          <ul
            tabIndex={0}
            className="dropdown-content z-10 menu menu-sm mt-1 w-40 rounded-box bg-base-100 border border-base-300 shadow-lg p-1"
          >
            <li>
              <button
                onClick={(e) => {
                  e.currentTarget.blur();
                  onGoAdvancedSettings();
                }}
              >
                <Settings className="w-3.5 h-3.5" />
                设定
              </button>
            </li>
            <li>
              <button
                onClick={(e) => {
                  e.currentTarget.blur();
                  onGoAdvancedOutline();
                }}
              >
                <ListTree className="w-3.5 h-3.5" />
                大纲
              </button>
            </li>
            <li>
              <button
                onClick={(e) => {
                  e.currentTarget.blur();
                  onGoArchives();
                }}
              >
                <Archive className="w-3.5 h-3.5" />
                归档
              </button>
            </li>
          </ul>
        </div>

        <button
          onClick={onDelete}
          className="text-base-content/30 hover:text-error transition-colors p-1.5 rounded-md hover:bg-error/10"
          title="删除小说"
          aria-label="删除小说"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
