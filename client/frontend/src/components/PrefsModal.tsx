/**
 * 全局偏好弹窗（list.html modalPrefs 的产品化）：
 * 默认字号/行距 seg（localStorage 即存即生效）+ 模型配置入口 + 账号行。
 * 原型「打开示例书」按钮在产品里是账号操作（登录/退出）。
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Modal from "@/components/design/Modal";
import { api } from "@/lib/api";
import { isLoggedIn, logout } from "@/lib/auth";
import {
  getDefaultFontSize,
  getDefaultLineHeight,
  setDefaultFontSize,
  setDefaultLineHeight,
  type FontSizePref,
  type LineHeightPref,
} from "@/lib/prefs";

const FONT_SIZES: { v: FontSizePref; label: string }[] = [
  { v: "fs-s", label: "小" },
  { v: "fs-m", label: "中" },
  { v: "fs-l", label: "大" },
];
const LINE_HEIGHTS: { v: LineHeightPref; label: string }[] = [
  { v: "lh-tight", label: "紧凑" },
  { v: "lh-comfy", label: "舒适" },
  { v: "lh-loose", label: "宽松" },
];

function tierLabel(r: any): string {
  if (!isLoggedIn()) return "未登录 · 单机使用";
  if (r?.expired) return "套餐已过期 · 免费待遇";
  if (r?.tier === "trial")
    return r?.trial_remaining_days > 0 ? `试用中 · 剩 ${r.trial_remaining_days} 天` : "试用中";
  if (r?.is_member) return "PRO 会员";
  return "免费版 · 可手工创作 1 本";
}

export default function PrefsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [fs, setFs] = useState<FontSizePref>("fs-m");
  const [lh, setLh] = useState<LineHeightPref>("lh-comfy");
  const [tier, setTier] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setFs(getDefaultFontSize());
    setLh(getDefaultLineHeight());
    api
      .post("/auth/verify")
      .then((r: any) => setTier(tierLabel(r)))
      .catch(() => setTier(tierLabel(null)));
  }, [open]);

  function save() {
    setDefaultFontSize(fs);
    setDefaultLineHeight(lh);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="设置 · 写作偏好"
      footer={
        <button className="btn btn-primary" onClick={save}>
          保存
        </button>
      }
    >
      <div className="pref-row">
        <div>
          <div className="pl">默认字号</div>
          <div className="pm">新建章节的正文排版</div>
        </div>
        <span className="seg">
          {FONT_SIZES.map((o) => (
            <button key={o.v} className={fs === o.v ? "on" : ""} onClick={() => setFs(o.v)}>
              {o.label}
            </button>
          ))}
        </span>
      </div>
      <div className="pref-row">
        <div>
          <div className="pl">默认行距</div>
          <div className="pm">长时写作建议「舒适」</div>
        </div>
        <span className="seg">
          {LINE_HEIGHTS.map((o) => (
            <button key={o.v} className={lh === o.v ? "on" : ""} onClick={() => setLh(o.v)}>
              {o.label}
            </button>
          ))}
        </span>
      </div>
      <div className="pref-row">
        <div>
          <div className="pl">模型配置 · API Key</div>
          <div className="pm">管理 AI 服务密钥与供应商</div>
        </div>
        <Link className="btn btn-secondary btn-sm" to="/config" onClick={onClose}>
          去配置
        </Link>
      </div>
      <div className="pref-row">
        <div>
          <div className="pl">账号</div>
          <div className="pm">{tier || "…"}</div>
        </div>
        {isLoggedIn() ? (
          <button className="btn btn-secondary btn-sm" onClick={logout}>
            退出登录
          </button>
        ) : (
          <Link className="btn btn-secondary btn-sm" to="/login" onClick={onClose}>
            登录
          </Link>
        )}
      </div>
    </Modal>
  );
}
