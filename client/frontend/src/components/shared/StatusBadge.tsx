import type { VendorId } from "../../types/api-config";

export type StatusBadgeStatus = "loading" | "no_key" | "no_model" | "configured" | "invalid";

interface StatusBadgeProps {
  status: StatusBadgeStatus;
  configName?: string;
  modelName?: string;
}

export function StatusBadge({ status, configName, modelName }: StatusBadgeProps) {
  if (status === "loading") {
    return <div className="skeleton h-5 w-30 rounded-full" data-loaded="false" />;
  }

  const base =
    "badge gap-1 px-3 py-2.5 text-xs font-normal no-underline cursor-pointer transition-all duration-200 hover:shadow-sm";

  const linkStyle = (path: string) => ({
    to: path,
    className: `${base} ${path === "/config" ? "" : ""}`,
  });

  switch (status) {
    case "no_key":
      return (
        <a href="/config" className={`${base} badge-ghost text-base-content/70`}>
          🔑 未配置 API Key
        </a>
      );
    case "no_model":
      return (
        <a href="/settings" className={`${base} badge-ghost text-base-content/70`}>
          🤖 未配置模型
        </a>
      );
    case "configured":
      return (
        <a href="/settings" className={`${base} badge-ghost text-base-content/70`}>
          {configName} / {modelName}
        </a>
      );
    case "invalid":
      return (
        <a href="/config" className={`${base} badge-error gap-1 text-error-content`}>
          ⚠️ 模型已失效
        </a>
      );
    default:
      return null;
  }
}
