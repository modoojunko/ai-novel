import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// 可视化演示用：带 slowMo 的派生配置，方便观察真实 E2E 操作过程。
// 用法：npx playwright test --config playwright.slowmo.config.ts --headed
export default defineConfig({
  ...base,
  use: {
    ...base.use,
    slowMo: 300,
  },
});
