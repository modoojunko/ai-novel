import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

// 完成判定 7 项（PRD 3.4）：与后端 gate_settings_complete 的 READINESS_KEYS 一致。
// ai-model 不参与判定（模型配置不是创作设定）。
const SETTINGS_TYPES = ["synopsis", "genre", "world", "style", "anti-ai", "hooks", "characters"];

export function useOnboarding(projectId: string | undefined, volumes: any[]) {
  const [settingsStatus, setSettingsStatus] = useState<Record<string, boolean> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/novels/${projectId}/settings/status`);
      setSettingsStatus(data);
    } catch {
      setSettingsStatus(null);
      setError("设定状态加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const hasVolumes = volumes.length > 0;
  const allConfirmed =
    settingsStatus !== null && SETTINGS_TYPES.every((t) => settingsStatus[t] === true);
  // 状态拉取失败时不误判为"新作品"（避免把用户错误拉回设定页）
  const isNew = settingsStatus !== null && !hasVolumes && !allConfirmed;

  const confirmSetting = useCallback(
    async (type: string): Promise<boolean> => {
      if (!projectId) return false;
      try {
        await api.put(`/novels/${projectId}/settings/status/${type}`);
        setSettingsStatus((prev) => ({
          ...Object.fromEntries(SETTINGS_TYPES.map((t) => [t, false])),
          ...prev,
          [type]: true,
        }));
        return true;
      } catch (e) {
        // 后端判定该项内容为空时返回 400（产品决策：点完成设定需内容非空）
        toast.error((e as Error).message || "该项还未填写内容");
        return false;
      }
    },
    [projectId],
  );

  return { settingsStatus, allConfirmed, isNew, confirmSetting, loading, error, loadStatus };
}
