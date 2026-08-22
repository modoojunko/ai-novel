import { useState, useCallback } from "react";
import { useModelStatus } from "../../../hooks/useModelStatus";

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
