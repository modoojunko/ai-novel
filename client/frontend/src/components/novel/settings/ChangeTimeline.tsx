// 模型变更历史（book.html v2 hist-row：mono 时间 + 描述 + 状态 tag + 恢复）。
// 数据逻辑不动（useChangeHistory），渲染层从 daisyUI 时间轴换为原型行式。
import { useState, useCallback } from "react";
import { useChangeHistory } from "../../../hooks/useChangeHistory";

interface ChangeTimelineProps {
  projectId: string;
}

/** 原型 hist-row 的 .ht 口径：MM-DD HH:mm（mono） */
function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
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

  if (loading) return <p className="opt">查询中…</p>;

  if (error) {
    return (
      <p className="opt" style={{ color: "var(--err)" }}>
        {error}
        <button className="text-btn" type="button" style={{ marginLeft: 8 }} onClick={refresh}>
          重试
        </button>
      </p>
    );
  }

  if (history.length === 0) return <p className="opt">暂无变更记录</p>;

  return (
    <div>
      {restoreError && (
        <p className="opt" style={{ color: "var(--err)" }}>{restoreError}</p>
      )}
      {history.map((entry, i) => (
        <div className="hist-row" key={entry.id}>
          <span className="ht">{entry.changed_at ? fmtTime(entry.changed_at) : ""}</span>
          <span>
            {entry.new_config_name && entry.new_model
              ? `${entry.new_config_name} / ${entry.new_model}`
              : "未配置"}
          </span>
          {i === 0 && <span className="tag">当前</span>}
          {i > 0 && entry.change_type === "initial" && <span className="tag">初始</span>}
          {i > 0 && entry.change_type === "restore" && <span className="tag">恢复</span>}
          {i > 0 && (
            <button
              className="text-btn"
              type="button"
              style={{ marginLeft: "auto" }}
              onClick={() => handleRestore(entry.id)}
              disabled={restoring === entry.id}
            >
              {restoring === entry.id ? "恢复中…" : "恢复"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
