import { useState, useCallback } from "react";
import type { ChangeEntry } from "../../../types/api-config";
import { useChangeHistory } from "../../../hooks/useChangeHistory";

interface ChangeTimelineProps {
  projectId: string;
}

export function ChangeTimeline({ projectId }: ChangeTimelineProps) {
  const { history, loading, error, restoreVersion, refresh } = useChangeHistory(projectId);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const handleRestore = useCallback(async (entryId: string) => {
    setRestoring(entryId);
    setRestoreError(null);
    try {
      await restoreVersion(entryId);
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : "恢复失败");
    } finally {
      setRestoring(null);
    }
  }, [restoreVersion]);

  if (loading) {
    return (
      <div className="space-y-4 py-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-base-300" />
              <div className="w-0.5 flex-1 bg-base-300" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-32" />
              <div className="skeleton h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-error py-3">
        {error}
        <button className="link link-primary ml-2" onClick={refresh}>重试</button>
      </div>
    );
  }

  if (history.length === 0) {
    return <p className="text-sm text-base-content/50 py-3 text-center">暂无变更记录</p>;
  }

  return (
    <div className="space-y-0 py-2">
      {restoreError && (
        <div className="alert alert-error text-sm mb-2">{restoreError}</div>
      )}
      {history.map((entry, i) => (
        <div key={entry.id} className="flex gap-3">
          {/* Timeline marker */}
          <div className="flex flex-col items-center">
            <div
              className={`w-3 h-3 rounded-full border-2 ${
                i === 0
                  ? "bg-primary border-primary"
                  : "bg-base-100 border-base-300"
              }`}
            />
            {i < history.length - 1 && <div className="w-0.5 flex-1 bg-base-300" />}
          </div>

          {/* Content */}
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-base-content/50">
                {entry.changed_at ? new Date(entry.changed_at).toLocaleString() : ""}
              </span>
              {i === 0 && <span className="badge badge-primary badge-xs">当前</span>}
              {entry.change_type === "initial" && <span className="badge badge-ghost badge-xs">初始</span>}
              {entry.change_type === "restore" && <span className="badge badge-info badge-xs">恢复</span>}
            </div>
            <div className="text-sm mt-1">
              {entry.new_config_name && entry.new_model
                ? `${entry.new_config_name} / ${entry.new_model}`
                : "未配置"}
            </div>
            {i > 0 && (
              <button
                className="btn btn-ghost btn-xs text-primary mt-1"
                onClick={() => handleRestore(entry.id)}
                disabled={restoring === entry.id}
              >
                {restoring === entry.id ? <span className="loading loading-spinner loading-xs" /> : null}
                恢复此版本
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
