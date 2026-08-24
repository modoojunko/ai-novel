/**
 * 能力注册表（2026-08-18 口径修订）。
 *
 * 只描述「是否会员功能」：人工写作能力免费完整可用；AI 能力是会员权益
 * （试用/付费/终身）。入口一律可见（不做 UI 隐藏）；使用由后端
 * require_ai_access 统一拦截，403 member_required → 前端弹升级引导。
 * 运营判定（免费限 1 本 / 试用横幅）不进清单，保留直判。
 * 纯 TS，无 DOM 依赖。
 */
export type FeatureKey =
  | "tree-crud"
  | "prose-edit"
  | "version-history"
  | "archive"
  | "volume-chapter-config"
  | "advanced-config-entry"
  | "settings-7-items"
  | "settings-ai-fields"
  | "outline-advanced-fields"
  | "ai-generate"
  | "prompt-panel"
  | "ai-model";

export const FEATURES: Record<FeatureKey, { memberOnly: boolean }> = {
  // 免费：完整人工写作能力
  "tree-crud": { memberOnly: false },
  "prose-edit": { memberOnly: false },
  "version-history": { memberOnly: false },
  "archive": { memberOnly: false },
  "volume-chapter-config": { memberOnly: false },
  "advanced-config-entry": { memberOnly: false },
  "settings-7-items": { memberOnly: false },
  // 会员：AI 能力（入口可见、使用需会员）
  "settings-ai-fields": { memberOnly: true },
  "outline-advanced-fields": { memberOnly: true },
  "ai-generate": { memberOnly: true },
  "prompt-panel": { memberOnly: true },
  "ai-model": { memberOnly: true },
};

/** 是否会员功能（AI 能力）——用于 PRO 标识/升级引导文案，不控制显隐。 */
export function isMemberFeature(key: FeatureKey): boolean {
  return FEATURES[key].memberOnly;
}
