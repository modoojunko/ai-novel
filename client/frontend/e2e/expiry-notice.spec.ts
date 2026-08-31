import { test, expect, type Page } from "@playwright/test";

/**
 * s-pay-foundation · C端 到期提示条（ExpiryNoticeBar）。
 * 数据源 = check-auth 扩展字段（days_remaining/attention）；
 * 优先级：核对中 > 退款处理中 > 临期 ≤7 天；关闭当日不重显、状态变化重显。
 * 打桩口径与 update-notice.spec 同源。
 */

interface CheckAuthStub {
  code: number;
  data?: {
    token?: string;
    username?: string;
    tier?: string;
    days_remaining?: number;
    attention?: { refund_processing?: boolean; verify_pending?: boolean };
  };
}

async function stubShell(page: Page, checkAuth: CheckAuthStub) {
  await page.addInitScript(() => {
    localStorage.setItem("auth_token", "expiry-notice-stub");
    localStorage.setItem("auth_username", "expiry-user");
  });
  await page.route("**/api/novels", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/auth/verify", (r) =>
    r.fulfill({ json: { tier: "pro", is_member: true, expired: false, trial_remaining_days: 0 } }),
  );
  await page.route("**/api/auth/check-auth", (r) => r.fulfill({ json: checkAuth }));
  await page.route("**/api/auth/config", (r) =>
    r.fulfill({ json: { has_api_key: true, portal_url: "https://portal-stub.example.com" } }),
  );
  // 外链域名就地打桩，避免 e2e 真出网
  await page.route(/portal-stub\.example\.com\//, (r) => r.fulfill({ body: "stubbed" }));
}

test.describe("C端 到期提示条", () => {
  test("临期 ≤7 天：显示续费提醒，去续费外跳门户 /pay", async ({ page }) => {
    await stubShell(page, { code: 0, data: { tier: "pro", days_remaining: 3 } });
    await page.goto("/#/novels");
    const strip = page.locator(".update-strip .notice");
    await expect(strip).toBeVisible();
    await expect(strip).toContainText("套餐还剩 3 天");
    const link = strip.getByRole("link", { name: "去续费" });
    await expect(link).toHaveAttribute("href", "https://portal-stub.example.com/pay");
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("退款处理中：优先于临期，外跳订单页", async ({ page }) => {
    await stubShell(page, {
      code: 0,
      data: { tier: "pro", days_remaining: 3, attention: { refund_processing: true } },
    });
    await page.goto("/#/novels");
    const strip = page.locator(".update-strip .notice");
    await expect(strip).toBeVisible();
    await expect(strip).toContainText("退款处理中");
    await expect(strip).toContainText(/原路退回/);
    await expect(page.locator(".update-strip")).not.toContainText(/套餐还剩/);
  });

  test("支付核对中：最高优先级，请勿重复支付口径", async ({ page }) => {
    await stubShell(page, {
      code: 0,
      data: {
        tier: "pro",
        days_remaining: 3,
        attention: { refund_processing: true, verify_pending: true },
      },
    });
    await page.goto("/#/novels");
    const strip = page.locator(".update-strip .notice");
    await expect(strip).toBeVisible();
    await expect(strip).toContainText("支付核对中");
    await expect(strip).toContainText(/请勿重复支付/);
  });

  test("临期 >7 天 / 无扩展字段：不渲染提示条", async ({ page }) => {
    await stubShell(page, { code: 0, data: { tier: "pro", days_remaining: 10 } });
    await page.goto("/#/novels");
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".update-strip")).toHaveCount(0);
    await expect(page.locator("h1", { hasText: "我的作品" })).toBeVisible();
  });

  test("「不再显示」当日不重显；天数变化（key 变）重显", async ({ page }) => {
    await stubShell(page, { code: 0, data: { tier: "pro", days_remaining: 5 } });
    await page.goto("/#/novels");
    const strip = page.locator(".update-strip .notice");
    await expect(strip).toBeVisible();
    await strip.getByRole("button", { name: "不再显示" }).click();
    await expect(page.locator(".update-strip")).toHaveCount(0);

    // 同态重新挂载（同 key 当日）→ 仍隐藏
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".update-strip")).toHaveCount(0);

    // 状态变化（剩 4 天 → key 变）→ 重显
    await page.unroute("**/api/auth/check-auth");
    await page.route("**/api/auth/check-auth", (r) =>
      r.fulfill({ json: { code: 0, data: { tier: "pro", days_remaining: 4 } } }),
    );
    await page.reload();
    const strip2 = page.locator(".update-strip .notice");
    await expect(strip2).toBeVisible();
    await expect(strip2).toContainText("套餐还剩 4 天");
  });
});
