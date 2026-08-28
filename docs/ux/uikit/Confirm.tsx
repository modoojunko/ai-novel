/**
 * ConfirmGuard（规范 §6.4 / §12）：设计语言内的确认弹窗，替代散落的
 * window.confirm ×5（逐页评估 J1）。
 *
 * 架构与 lib/toast.tsx 同构：模块级单例 + <ConfirmHost/> 挂载一次
 * （挂在 ClientShell 与 <Toaster/> 同层）。业务代码无需持有本地 state：
 *
 *   const ok = await confirmAction({ title: "删除这个模型配置？", tone: "danger",
 *                                   inventory: ["3 本书正在使用它"] });
 *   if (!ok) return;
 *
 * 口径沿 Modal：hideClose=true（确认族无 X，ADJUSTMENTS.md 已登记的既定口径）。
 * 刻意不加 locked —— Esc 与点遮罩等于「取消」，这对确认类是安全方向；
 * locked 只用于提交中防重复关闭的场景。
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Modal from "@/components/design/Modal";

export interface ConfirmOptions {
  title: string;
  /** 正文一句：丢的是什么、是否可逆（规则 D-R1：不许只写「确定吗？」） */
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger 时确认钮用 .btn-danger —— 红色只表示不可逆（N6） */
  tone?: "default" | "danger";
  /** 删除影响盘点 chips（§12 L2 盘点确认），例如 ["章纲已确认", "正文 2,486 字"] */
  inventory?: string[];
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

let pending: Pending | null = null;
const subscribers = new Set<(req: Pending | null) => void>();

function emit(next: Pending | null) {
  pending = next;
  subscribers.forEach((sub) => sub(next));
}

export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => emit({ ...opts, resolve }));
}

/** 全局挂载一次。未打开时自身不渲染任何 DOM。 */
export function ConfirmHost() {
  const [req, setReq] = useState<Pending | null>(null);

  useEffect(() => {
    subscribers.add(setReq);
    setReq(pending); // 订阅前已发起的请求也能接住
    return () => {
      subscribers.delete(setReq);
    };
  }, []);

  const settle = (ok: boolean) => {
    req?.resolve(ok);
    emit(null);
  };

  if (!req) return null;

  return (
    <Modal
      open
      onClose={() => settle(false)}
      title={req.title}
      width={400}
      hideClose
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => settle(false)}>
            {req.cancelLabel ?? "取消"}
          </button>
          <button
            type="button"
            className={req.tone === "danger" ? "btn btn-danger" : "btn btn-primary"}
            onClick={() => settle(true)}
          >
            {req.confirmLabel ?? "确定"}
          </button>
        </>
      }
    >
      {req.body && <p style={{ color: "var(--muted)", margin: 0, lineHeight: 1.7 }}>{req.body}</p>}
      {req.inventory && req.inventory.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: req.body ? 14 : 0 }}>
          {req.inventory.map((item) => (
            <span key={item} className="pill">
              {item}
            </span>
          ))}
        </div>
      )}
    </Modal>
  );
}
