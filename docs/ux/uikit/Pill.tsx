/**
 * 胶囊家族（规范 §6.2）—— 13 种存量胶囊收敛为「角色 × 语气」两根轴。
 *
 * 边界规则：
 *   - 可点击的胶囊（筛选、跳转定位）不是 Pill，是 `.chip`（book.css:320，含 .on 选中态）。
 *   - PRO 徽沿用现有 `.pill-pro`（book.css:35），本文件只提供它的调用壳。
 *
 * CSS 见同目录 uikit.css 第 1 段（收编时并入 base.css）。
 */
import type { ReactNode } from "react";
import { Ico, P } from "@/components/icons";

export type PillRole = "tag" | "status" | "count";
export type PillTone = "neutral" | "ok" | "warn" | "err" | "accent";

const ROLE_CLS: Record<PillRole, string> = {
  tag: "",
  status: " pill-status",
  count: " pill-count",
};

const TONE_CLS: Record<PillTone, string> = {
  neutral: "",
  ok: " pill-ok",
  warn: " pill-warn",
  err: " pill-err",
  accent: " pill-accent",
};

interface PillProps {
  /** tag=标签（描边）· status=状态徽标（软底）· count=计数（等宽数字） */
  role?: PillRole;
  /** 中性灰阶之外的四种语义，颜色语义以规范 §5 总表为准 */
  tone?: PillTone;
  children?: ReactNode;
}

export function Pill({ role = "tag", tone = "neutral", children }: PillProps) {
  return (
    <span className={`pill${ROLE_CLS[role]}${TONE_CLS[tone]}`}>{children}</span>
  );
}

/**
 * PRO 徽标：付费身份唯一使用 accent 强度的胶囊（novelbar 同款视觉）。
 * 免费侧提示句继续用现有 `.free-hint`，两者是一对的。
 */
export function ProPill({ label = "PRO" }: { label?: string }) {
  return (
    <span className="pill-pro">
      <Ico d={P.star} fill size={11} />
      {label}
    </span>
  );
}

/** 锁定入口角标（规范 §11 可见 + 锁定首选策略）：入口保留、语义改成「差什么」 */
export function LockBadge({ label = "PRO" }: { label?: string }) {
  return (
    <span className="pill pill-accent">
      <Ico d={P.lock} size={10} />
      {label}
    </span>
  );
}
