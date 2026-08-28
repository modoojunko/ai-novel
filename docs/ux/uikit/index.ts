/**
 * C 端统一组件候选集出口。
 * 搬运目标：client/frontend/src/components/ui/（路径别名 @/components/ui/…）。
 * 采用顺序与映射表见 README.md —— 先过原型与 design:check，再迁移调用点。
 */
export { Pill, ProPill, LockBadge } from "./Pill";
export type { PillRole, PillTone } from "./Pill";

export { StatusDot, SaveState, LiveDot } from "./Status";
export type { TriState, SavePhase } from "./Status";

export { Notice } from "./Notice";
export type { NoticeTone } from "./Notice";

export { EmptyState } from "./EmptyState";

export { confirmAction, ConfirmHost } from "./Confirm";
export type { ConfirmOptions } from "./Confirm";
