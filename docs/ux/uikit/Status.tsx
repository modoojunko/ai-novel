/**
 * 对象状态语言的几何件（规范 §5）：
 *   StatusDot — 树/列表三态点，类名与现网 OutlineTree 用法完全一致；
 *   SaveState — 保存四态聚合，取自 ChapterWorkspace.tsx:428-434 的手写实现。
 *
 * 配套 CSS：dot 三类收编后全局化（uikit.css 第 2 段），
 *           .save-state 已存在于 book.css:138-143，无需新增。
 */
import { Ico, P } from "@/components/icons";

export type TriState = "unfilled" | "in_progress" | "confirmed";

const DOT_CLS: Record<TriState, string> = {
  unfilled: "dot-empty",
  in_progress: "dot-warn",
  confirmed: "dot-ok",
};

/** title 必传：三态点无图例，悬浮文案是它唯一的解释通道（逐页评估 E2） */
export function StatusDot({ state, title }: { state: TriState; title?: string }) {
  return <span className={DOT_CLS[state]} title={title} />;
}

export type SavePhase = "autosaving" | "unsaved" | "failed" | "saved";

const SAVE_TEXT: Record<SavePhase, string> = {
  autosaving: "保存中…",
  unsaved: "未保存",
  failed: "保存失败 · 重试",
  saved: "已自动保存",
};

const PHASE_CLS: Record<SavePhase, string> = {
  autosaving: "saving",
  unsaved: "dirty",
  failed: "failed",
  saved: "saved",
};

/**
 * 编辑器右下角常驻的状态条。failed 且给了 onRetry 时渲染成可点击的文字钮，
 * 其余情况只是安静的小字（正文优先原则：不打断心流）。
 */
export function SaveState({
  state,
  onRetry,
}: {
  state: SavePhase;
  onRetry?: () => void;
}) {
  if (state === "failed" && onRetry) {
    return (
      <button
        type="button"
        className={`save-state ${PHASE_CLS[state]} num`}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        onClick={onRetry}
      >
        <Ico d={P.alert} size={13} />
        {SAVE_TEXT.failed}
      </button>
    );
  }
  return (
    <span className={`save-state ${PHASE_CLS[state]} num`} aria-live="polite">
      {state === "autosaving" && <Ico d={P.spinner} size={13} />}
      {SAVE_TEXT[state]}
    </span>
  );
}

/** 流式生成中的伴随指示点（规范 A4 形）：只点呼吸，正文区不加动画（M-R2） */
export function LiveDot() {
  return <span className="dot-live" aria-label="生成中" />;
}
