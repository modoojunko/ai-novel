import { test, expect } from "@playwright/test";

// 顶栏「联系客服」外跳入口（contact-support-page）：
// 地址 = portal_url 去尾斜杠拼 /support；取不到门户地址时按钮不渲染（不出死链）。
// 工作台变体与列表屏共用同一 support 状态与 SupportLink 组件，此处覆盖列表屏主路径。
async function stubShell(page: import("@playwright/test").Page, portalUrl: string) {
  await page.addInitScript(() => {
    localStorage.setItem("auth_token", "support-e2e-stub");
    localStorage.setItem("auth_username", "support-e2e");
  });
  await page.route("**/api/novels", (r) => r.fulfill({ json: [] }));
  await page.route(
    "**/api/auth/verify",
    (r) => r.fulfill({ json: { tier: "pro", is_member: true, expired: false, trial_remaining_days: 0 } }),
  );
  await page.route("**/api/auth/config", (r) => r.fulfill({ json: { has_api_key: true, portal_url: portalUrl } }));
  await page.route("**/api/auth/check-auth", (r) => r.fulfill({ json: { code: 1 } }));
}

test.describe("顶栏联系客服", () => {
  test("有门户地址（带尾斜杠）：按钮外跳 <portal>/support，新窗口锚点", async ({ page }) => {
    await stubShell(page, "https://www.awesomenovel.com/");
    await page.goto("/#/novels");
    const btn = page.locator("header.appbar a.btn", { hasText: "联系客服" });
    await expect(btn).toBeVisible();
    // 尾斜杠被剥后拼路径
    await expect(btn).toHaveAttribute("href", "https://www.awesomenovel.com/support");
    // pywebview cocoa 只认锚点 target=_blank，禁编程式 window.open
    await expect(btn).toHaveAttribute("target", "_blank");
    await expect(btn).toHaveAttribute("rel", "noreferrer");
  });

  test("门户地址为空：按钮不渲染，无死链", async ({ page }) => {
    await stubShell(page, "");
    await page.goto("/#/novels");
    await expect(page.locator("header.appbar a.btn", { hasText: "联系客服" })).toHaveCount(0);
  });

  test("未登录：顶栏只有登录入口，不出客服按钮", async ({ page }) => {
    await page.route("**/api/novels", (r) => r.fulfill({ json: [] }));
    await page.route(
      "**/api/auth/verify",
      (r) => r.fulfill({ json: { tier: "none", is_member: false, expired: false, trial_remaining_days: 0 } }),
    );
    await page.route("**/api/auth/config", (r) => r.fulfill({ json: { has_api_key: true, portal_url: "https://www.awesomenovel.com" } }));
    await page.goto("/#/novels");
    await expect(page.locator("header.appbar a.btn", { hasText: "联系客服" })).toHaveCount(0);
    await expect(page.locator("header.appbar a.btn", { hasText: "登录" })).toBeVisible();
  });
});
