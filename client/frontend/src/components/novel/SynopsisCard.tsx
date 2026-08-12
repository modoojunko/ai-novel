import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { BookOpen, Loader2 } from "lucide-react";
import ConfirmToggle from "./settings/ConfirmToggle";

interface SynopsisCardProps {
  projectId: string;
  /** PRD 3.4：简介完成确认状态（settings-status.yaml.synopsis） */
  confirmed?: boolean;
  /** PRD 3.4：点「完成设定」回调（PUT /settings/status/synopsis） */
  onConfirm?: () => void;
}

/**
 * 故事简介补录卡（PRD 3.3）——settings 面板全局常驻（跨所有左侧子节点可见）。
 * 手动填写 synopsis 并保存到 story.yaml，不触发任何 AI 调用。
 * PRD 3.4：提供「完成设定」确认按钮（与其它设定项口径一致）。
 */
export default function SynopsisCard({ projectId, confirmed, onConfirm }: SynopsisCardProps) {
  const [synopsis, setSynopsis] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  // P3-4：用户已手动输入时，晚到的挂载 fetch 不得覆盖输入
  const editedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api
      .fetchStory(projectId)
      .then((r) => {
        if (!cancelled) {
          if (!editedRef.current) setSynopsis(r.synopsis ?? "");
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const r = await api.updateStory(projectId, synopsis);
      setSynopsis(r.synopsis);
      toast.success("简介已保存");
    } catch {
      toast.error("简介保存失败");
    } finally {
      setSaving(false);
    }
  }, [projectId, synopsis, saving]);

  return (
    <div
      id="synopsis-card"
      className="bg-base-200/40 border border-base-300/60 rounded-xl p-4 mb-5"
    >
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-4 h-4 text-primary shrink-0" />
        <h3 className="text-sm font-semibold text-base-content">故事简介</h3>
        {loaded && synopsis.trim() && (
          <span className="badge badge-success badge-xs">已补录</span>
        )}
      </div>
      <textarea
        className="textarea textarea-bordered w-full text-sm leading-relaxed"
        placeholder="用几句话讲讲这个故事是关于什么的（主角、世界、核心冲突）"
        rows={3}
        maxLength={500}
        value={synopsis}
        onChange={(e) => {
          editedRef.current = true;
          setSynopsis(e.target.value);
        }}
        disabled={saving}
        aria-label="故事简介"
      />
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-base-content/50">
          简介会作为后续设定和写作的依据
        </p>
        <div className="flex items-center gap-2">
          {onConfirm && (
            <ConfirmToggle confirmed={!!confirmed} onToggle={onConfirm} />
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={save}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            保存简介
          </button>
        </div>
      </div>
    </div>
  );
}
