import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { BookOpen, Loader2 } from "lucide-react";

interface SynopsisCardProps {
  projectId: string;
}

/**
 * 故事简介补录卡（PRD 3.3）——settings 面板全局常驻（跨所有左侧子节点可见）。
 * 手动填写 synopsis 并保存到 story.yaml，不触发任何 AI 调用。
 */
export default function SynopsisCard({ projectId }: SynopsisCardProps) {
  const [synopsis, setSynopsis] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .fetchStory(projectId)
      .then((r) => {
        if (!cancelled) {
          setSynopsis(r.synopsis ?? "");
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
    <div className="bg-base-200/40 border border-base-300/60 rounded-xl p-4 mb-5">
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
        onChange={(e) => setSynopsis(e.target.value)}
        disabled={saving}
        aria-label="故事简介"
      />
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-base-content/50">
          简介会作为后续设定和写作的依据
        </p>
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
  );
}
