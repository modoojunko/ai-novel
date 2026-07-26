import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

const SETTINGS_TYPES = ["world", "style", "anti-ai", "hooks", "characters", "ai-model"];

export function useOnboarding(projectId: string | undefined, volumes: any[]) {
  const [settingsStatus, setSettingsStatus] = useState<Record<string, boolean> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    api
      .get(`/projects/${projectId}/settings/status`)
      .then((data: any) => setSettingsStatus(data))
      .catch(() => setSettingsStatus(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  const hasVolumes = volumes.length > 0;
  const allConfirmed =
    settingsStatus !== null && SETTINGS_TYPES.every((t) => settingsStatus[t] === true);
  const isNew = !hasVolumes && !allConfirmed;

  const confirmSetting = useCallback(
    async (type: string) => {
      if (!projectId) return;
      await api.put(`/projects/${projectId}/settings/status/${type}`);
      setSettingsStatus((prev) => ({
        ...Object.fromEntries(SETTINGS_TYPES.map((t) => [t, false])),
        ...prev,
        [type]: true,
      }));
    },
    [projectId],
  );

  return { settingsStatus, allConfirmed, isNew, confirmSetting, loading };
}
