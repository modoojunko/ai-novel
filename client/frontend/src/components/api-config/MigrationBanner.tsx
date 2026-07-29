import { useState, useEffect } from "react";

const STORAGE_KEY = "migration_banner_dismissed";

interface MigrationBannerProps {
  migrationCompleted?: boolean;
}

export function MigrationBanner({ migrationCompleted }: MigrationBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (migrationCompleted === false && !localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [migrationCompleted]);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  const scrollToConfigs = () => {
    const el = document.getElementById("api-config-list");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="alert alert-info flex-row items-start gap-3 rounded-xl border-l-4 border-info mb-4">
      <div className="flex-1">
        <h4 className="font-semibold text-sm">API Key 管理已升级</h4>
        <p className="text-xs text-base-content/70 mt-1">
          你的 API Key 已升级为多配置管理方式。现在你可以管理多个 API Key，为不同小说选择不同模型。
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button className="btn btn-sm btn-ghost" onClick={dismiss}>
          知道了
        </button>
        <button className="btn btn-sm btn-primary" onClick={scrollToConfigs}>
          去查看
        </button>
      </div>
    </div>
  );
}
