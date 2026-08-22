import { useState, useEffect } from "react";
import { Ico, P } from "../icons";

const STORAGE_KEY = "migration_banner_dismissed";

interface MigrationBannerProps {
  migrationCompleted?: boolean;
}

/** 老用户迁移提示（应用侧扩展，原型未建模；用本屏 notice 版式表达） */
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
    <div className="notice">
      <Ico d={P.info} sw={1.8} />
      <span style={{ flex: 1 }}>
        API Key 管理已升级为多配置方式，现在可以管理多个 API Key，为不同小说选择不同模型。
      </span>
      <button className="btn btn-secondary btn-sm" onClick={scrollToConfigs}>
        去查看
      </button>
      <button className="btn btn-ghost btn-sm" onClick={dismiss}>
        知道了
      </button>
    </div>
  );
}
