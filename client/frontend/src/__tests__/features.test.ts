import { describe, it, expect } from "vitest";
import { FEATURES, isFeatureEnabled, type FeatureKey } from "@/lib/features";

const FREE_ENABLED: FeatureKey[] = [
  "tree-crud",
  "prose-edit",
  "version-history",
  "archive",
  "volume-chapter-config",
  "advanced-config-entry",
  "settings-7-items",
];

const FREE_LOCKED: FeatureKey[] = [
  "settings-ai-fields",
  "outline-advanced-fields",
  "ai-generate",
  "prompt-panel",
  "ai-model",
];

describe("isFeatureEnabled — 两态矩阵", () => {
  it("免费键在 none/pro 两态均可用", () => {
    for (const key of FREE_ENABLED) {
      expect(isFeatureEnabled(key, "none"), key).toBe(true);
      expect(isFeatureEnabled(key, "monthly"), key).toBe(true);
    }
  });

  it("锁定键（AI）免费态不可用、付费态可用", () => {
    for (const key of FREE_LOCKED) {
      expect(isFeatureEnabled(key, "none"), key).toBe(false);
      expect(isFeatureEnabled(key, "monthly"), key).toBe(true);
    }
  });

  it("清单键与两态分组完全覆盖（无遗漏无多键）", () => {
    const keys = Object.keys(FEATURES) as FeatureKey[];
    expect(keys.length).toBe(FREE_ENABLED.length + FREE_LOCKED.length);
    for (const key of keys) {
      const inFree = FREE_ENABLED.includes(key);
      const inLocked = FREE_LOCKED.includes(key);
      expect(inFree || inLocked, key).toBe(true);
      expect(FEATURES[key].free).toBe(inFree);
    }
  });
});
