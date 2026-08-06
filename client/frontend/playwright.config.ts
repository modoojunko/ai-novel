import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report" }]],
  use: {
    // 默认连 docker 生产前端（nginx 托管 dist + /api 代理到 client-backend:8000）。
    // 本地 dev 可 E2E_BASE_URL=http://localhost:5173 覆盖。
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5174/",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
