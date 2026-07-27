import { useState } from "react";
import type { ApiConfig, ConnectionStatus } from "../../types/api-config";
import { ProviderIcon } from "./ProviderIcon";
import type { StatusBadgeStatus } from "../shared/StatusBadge";

interface ApiConfigCardProps {
  config: ApiConfig;
  onEdit: (config: ApiConfig) => void;
  onDelete: (config: ApiConfig) => void;
}

const STATUS_BORDER: Record<string, string> = {
  auth_error: "border-red-400",
  timeout: "border-orange-400",
  network_error: "border-orange-400",
  unknown: "border-orange-400",
  rate_limited: "border-purple-400",
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  auth_error: { text: "认证失败", cls: "badge-error" },
  timeout: { text: "连接超时", cls: "badge-warning" },
  network_error: { text: "网络错误", cls: "badge-warning" },
  rate_limited: { text: "频率限制", cls: "badge-secondary" },
  ok: { text: "连接正常", cls: "badge-success" },
};

function getStatusClass(status: ConnectionStatus | null | undefined): string {
  if (!status) return "";
  return STATUS_BORDER[status] || "";
}

function ConnectionStatusTag({ status }: { status: ConnectionStatus | null | undefined }) {
  if (!status) return <span className="badge badge-ghost badge-sm">未测试</span>;
  const info = STATUS_LABEL[status];
  if (!info) return <span className="badge badge-ghost badge-sm">{status}</span>;
  return <span className={`badge badge-sm ${info.cls}`}>{info.text}</span>;
}

export function ApiConfigCard({ config, onEdit, onDelete }: ApiConfigCardProps) {
  const borderClass = getStatusClass(config.last_test_status);

  return (
    <div
      className={`card bg-base-100 border-2 p-5 space-y-3 transition-shadow hover:shadow-md ${borderClass || "border-base-300"}`}
      data-loaded="true"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <ProviderIcon vendor={config.vendor} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{config.name}</h3>
          <p className="text-xs text-base-content/60 truncate">{config.base_url}</p>
        </div>
        <ConnectionStatusTag status={config.last_test_status} />
      </div>

      {/* Masked Key */}
      <div className="text-xs text-base-content/50 font-mono">{config.api_key_masked}</div>

      {/* Models */}
      {config.models && config.models.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {config.models.slice(0, 5).map((m) => (
            <span key={m} className="badge badge-ghost badge-xs">
              {m}
            </span>
          ))}
          {config.models.length > 5 && (
            <span className="badge badge-ghost badge-xs">+{config.models.length - 5}</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button className="btn btn-ghost btn-xs" onClick={() => onEdit(config)}>
          编辑
        </button>
        <button
          className="btn btn-ghost btn-xs text-error"
          onClick={() => onDelete(config)}
        >
          删除
        </button>
      </div>
    </div>
  );
}
