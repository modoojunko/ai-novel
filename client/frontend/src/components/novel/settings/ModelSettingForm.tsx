import { useState, useCallback } from "react";
import { useModelStatus } from "../../../hooks/useModelStatus";
import { getToken } from "../../../lib/auth";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { "Authorization": `Bearer ${token}` } : {};
}
import { StatusBadge } from "../../shared/StatusBadge";
import { ModelSelector } from "./ModelSelector";
import { ChangeTimeline } from "./ChangeTimeline";
import { NovelUsagePanel } from "./NovelUsagePanel";

interface ModelSettingFormProps {
  projectId: string;
  settingKey: string;
}

export default function ModelSettingForm({ projectId }: ModelSettingFormProps) {
  const { status, modelOptions, currentModel, currentConfigId, currentConfigName, hasKeys, loading, selectModel } = useModelStatus(projectId);
  const [saving, setSaving] = useState(false);
  const [showApplyAll, setShowApplyAll] = useState(false);
  const [applyResult, setApplyResult] = useState<{ succeeded: string[]; failed: Array<{ id: string; reason: string }> } | null>(null);
  const [applying, setApplying] = useState(false);

  const handleSelect = useCallback(async (apiConfigId: string, model: string) => {
    setSaving(true);
    try {
      await selectModel(apiConfigId, model);
    } catch {
      // error handled by hook
    } finally {
      setSaving(false);
    }
  }, [selectModel]);

  const handleApplyToAll = useCallback(async () => {
    if (!currentConfigId || !currentModel) return;
    setApplying(true);
    try {
      const resp = await fetch("/api/v1/novels/apply-model-to-all", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ api_config_id: currentConfigId, model: currentModel }),
      });
      const data = await resp.json();
      setApplyResult(data);
    } catch {
      // ignore
    } finally {
      setApplying(false);
    }
  }, [currentConfigId, currentModel]);

  if (!projectId) return null;

  return (
    <div className="space-y-6" data-setting-key="ai-model">
      {/* Status Badge */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-base-content/70">当前状态：</span>
        <StatusBadge
          status={status}
          configName={currentConfigName || undefined}
          modelName={currentModel || undefined}
        />
      </div>

      {/* No keys guide */}
      {!hasKeys && !loading && (
        <div className="alert">
          <span>暂无可用 API Key，</span>
          <a href="/config" className="link link-primary">去配置</a>
        </div>
      )}

      {/* Model Selector */}
      {hasKeys && (
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-2">
            选择模型
            {saving && <span className="loading loading-spinner loading-xs ml-2" />}
          </label>
          <ModelSelector
            options={modelOptions}
            currentConfigId={currentConfigId}
            currentModel={currentModel}
            onSelect={handleSelect}
            loading={loading}
          />
        </div>
      )}

      {/* Apply to all */}
      {hasKeys && currentConfigId && (
        <div className="flex items-center gap-2">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowApplyAll(!showApplyAll)}
          >
            应用到所有小说
          </button>
          {showApplyAll && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleApplyToAll}
              disabled={applying}
            >
              {applying ? <span className="loading loading-spinner loading-xs" /> : null}
              确认应用
            </button>
          )}
          {applyResult && (
            <span className="text-xs text-base-content/50">
              成功：{applyResult.succeeded.length}
              {applyResult.failed.length > 0 && `，失败：${applyResult.failed.length}`}
            </span>
          )}
        </div>
      )}

      {/* Change History */}
      <div>
        <h4 className="text-sm font-medium text-base-content/80 mb-2">变更历史</h4>
        <ChangeTimeline projectId={projectId} />
      </div>

      {/* Usage */}
      <div>
        <h4 className="text-sm font-medium text-base-content/80 mb-2">用量统计</h4>
        <NovelUsagePanel projectId={projectId} />
      </div>
    </div>
  );
}
