/**
 * 能力注册表（C1/N14：禁止散落 `if (tier === 'none')`）。
 *
 * 只管功能显隐：免费 ✅ = 完整人工写作能力；锁定 🔒 = AI 属 PRO。
 * 运营判定（免费限 1 本 / 试用横幅 / gate 警告）不进清单，保留直判。
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

export const FEATURES: Record<FeatureKey, { free: boolean }> = {
  // 免费 ✅：完整人工写作能力
  "tree-crud": { free: true },
  "prose-edit": { free: true },
  "version-history": { free: true },
  "archive": { free: true },
  "volume-chapter-config": { free: true },
  "advanced-config-entry": { free: true },
  "settings-7-items": { free: true },
  // 免费 🔒：AI 属 PRO
  "settings-ai-fields": { free: false },
  "outline-advanced-fields": { free: false },
  "ai-generate": { free: false },
  "prompt-panel": { free: false },
  "ai-model": { free: false },
};

/** 免费键恒 true；锁键仅付费（tier !== "none"）为 true。 */
export function isFeatureEnabled(key: FeatureKey, tier: string): boolean {
  return FEATURES[key].free || tier !== "none";
}
