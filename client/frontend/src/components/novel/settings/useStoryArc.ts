// 主线卡共享状态（settings-three-col）：SettingsView 持有，主线表单与右栏
// AI 向导共用同一份 arc —— 向导产出自动落卡不会覆盖表单未保存的编辑。
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useDirtyState } from "@/hooks/useDirtyState";

export interface ArcVolumeRow {
  title: string;
  conflict: string;
  chapters: string;
}

export interface ArcData {
  premise: string;
  ending: { scene: string; hero: string; tone: string };
  volumes: ArcVolumeRow[];
}

export const EMPTY_ARC: ArcData = {
  premise: "",
  ending: { scene: "", hero: "", tone: "" },
  volumes: [],
};

/** 旧数据里的占位基调（待定/？）按未选处理；合法值=三预设或任意自定义文本 */
export function normTone(t: unknown): string {
  const s = typeof t === "string" ? t : "";
  return s === "待定" || s === "？" || s === "?" ? "" : s;
}

export interface ArcCtl {
  projectId: string;
  arc: ArcData;
  loading: boolean;
  saving: boolean;
  /** 后端按卡片内容推断的续步位置（第一个未完成步骤） */
  resumeStep: number;
  patch: (p: Partial<ArcData>) => void;
  save: () => Promise<boolean>;
  /** 向导产出落卡：写状态 + 整卡 PUT + 标记已保存（可续的持久化基础） */
  applyWizard: (next: ArcData, nextResume: number) => Promise<void>;
}

export function useStoryArc(
  projectId: string,
  enabled = true,
  onDirtyChange?: (dirty: boolean) => void,
): ArcCtl {
  const [arc, setArc] = useState<ArcData>(EMPTY_ARC);
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [resumeStep, setResumeStep] = useState(1);
  // P3-4：晚到的挂载 fetch 不得覆盖用户输入
  const editedRef = useRef(false);
  const { snapshotLoaded, markSaved } = useDirtyState(arc, onDirtyChange);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    editedRef.current = false;
    api
      .fetchStoryArc(projectId)
      .then((d: any) => {
        if (cancelled || editedRef.current) return;
        const next: ArcData = {
          premise: d.premise ?? "",
          ending: {
            scene: d.ending?.scene ?? "",
            hero: d.ending?.hero ?? "",
            tone: normTone(d.ending?.tone),
          },
          volumes: Array.isArray(d.volumes)
            ? d.volumes.map((v: any) => ({
                title: v.title ?? "", conflict: v.conflict ?? "", chapters: v.chapters ?? "",
              }))
            : [],
        };
        setArc(next);
        setResumeStep(typeof d.next_step === "number" ? d.next_step : 1);
        snapshotLoaded(next);
      })
      .catch(() => !cancelled && snapshotLoaded(EMPTY_ARC))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // snapshotLoaded 引用稳定；仅项目/启用态变化重拉
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, enabled]);

  const patch = useCallback((p: Partial<ArcData>) => {
    editedRef.current = true;
    setArc((prev) => ({ ...prev, ...p }));
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (saving) return false;
    setSaving(true);
    try {
      await api.updateStoryArc(projectId, arc);
      markSaved();
      return true;
    } catch {
      toast.error("主线保存失败");
      return false;
    } finally {
      setSaving(false);
    }
  }, [projectId, arc, saving, markSaved]);

  const applyWizard = useCallback(
    async (next: ArcData, nextResume: number) => {
      editedRef.current = true;
      setArc(next);
      setResumeStep(nextResume);
      await api.updateStoryArc(projectId, next).catch(() => toast.error("主线保存失败"));
      markSaved();
    },
    [projectId, markSaved],
  );

  return { projectId, arc, loading, saving, resumeStep, patch, save, applyWizard };
}
