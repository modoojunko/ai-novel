/**
 * Notice 条（规范 §6.4）：在现有 `.notice`（list.css:50 默认 warn + .info）之上
 * 补齐 ok / err 两档，凑成四语气。语气词表 info|ok|warn|err 为全站统一元组，
 * 与 S端 .strip、dot-ok/dot-warn、toast.err 同词（裁决依据 ../cross-end.html §3.2）。
 *
 * 语气纪律来自规范 N6：红只给不可逆或即时生效；普通提醒一律 info/warn/ok。
 * 成功提示优先考虑 toast（瞬态）；Notice 用于常驻的解释性内容。
 */
import type { ReactNode } from "react";
import { Ico, P } from "@/components/icons";

export type NoticeTone = "info" | "ok" | "warn" | "err";

const TONE: Record<NoticeTone, { cls: string; d: string }> = {
  info: { cls: "info", d: P.info },
  ok: { cls: "ok", d: P.check },
  warn: { cls: "", d: P.alert },
  err: { cls: "err", d: P.alert },
};

interface NoticeProps {
  tone?: NoticeTone;
  /** 加粗主句；补一句人话解释时用 desc */
  children: ReactNode;
  desc?: ReactNode;
  /** 就地解决出口（规范 P3：任何警示都要有出路） */
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
}

export function Notice({ tone = "warn", children, desc, action, onClose }: NoticeProps) {
  const t = TONE[tone];
  return (
    <div className={`notice${t.cls ? ` ${t.cls}` : ""}`}>
      <Ico className="nico" d={t.d} size={15} />
      <span className="nt">
        <b>{children}</b>
        {desc != null && <span>{desc}</span>}
      </span>
      {action && (
        <button type="button" className="text-btn" onClick={action.onClick}>
          {action.label}
        </button>
      )}
      {onClose && (
        <button type="button" className="notice-x" onClick={onClose} aria-label="关闭提示">
          <Ico d={P.close} size={13} />
        </button>
      )}
    </div>
  );
}
