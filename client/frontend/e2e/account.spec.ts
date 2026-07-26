import { test, expect } from "@playwright/test";
import { url, API_URL, createTestUser, setToken } from "./helpers";

// =========================================================================
// Account — API Key, License, and Device Management
// C端-分支路径1：续费与设备管理
// =========================================================================

async function mockConfig(page: any, hasApiKey: boolean) {
  await page.route("**/auth/config", async (route: any) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          hasApiKey
            ? {
                has_api_key: true,
                api_base_url: "https://api.deepseek.com/anthropic",
                api_model: "deepseek-v4-flash",
                has_token: true,
                tier: "lifetime",
                expires_at: "2030-01-01",
              }
            : { has_api_key: false, api_base_url: "", api_model: "" }
        ),
      });
    } else {
      await route.continue();
    }
  });
}

async function mockVerify(page: any, tier: string, trialDays: number) {
  await page.route("**/auth/verify", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tier,
        trial_remaining_days: trialDays,
        expires_at: trialDays > 0 ? "" : "2026-01-01",
      }),
    });
  });
}

test.describe("Account — API Key Config", () => {
  // -----------------------------------------------------------------------
  // Story 9.1: 检查 API Key 状态
  // -----------------------------------------------------------------------

  test("Story 9.1: config page shows provider selection when no key configured", async ({ page }) => {
    await mockConfig(page, false);

    await page.goto(url("/books"));
    const { token } = await createTestUser(page);
    await setToken(page, token);

    await page.goto(url("/config"));
    // Wait for page heading instead of networkidle
    await expect(page.getByRole("heading", { name: "AI 模型配置" })).toBeVisible({ timeout: 10000 });

    // Provider cards should be visible (DeepSeek, OpenAI, etc.)
    await expect(page.getByRole("heading", { name: "DeepSeek（推荐）" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "OpenAI" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Anthropic (Claude)" })).toBeVisible();

    // Skip button must be present
    await expect(page.getByText("跳过配置，稍后再说")).toBeVisible();
  });

  test("Story 9.1: reconfig entry visible when key is already configured", async ({ page }) => {
    await mockConfig(page, true);

    await page.goto(url("/books"));
    const { token } = await createTestUser(page);
    await setToken(page, token);

    await page.goto(url("/config"));
    await expect(page.getByRole("heading", { name: "AI 模型配置" })).toBeVisible({ timeout: 10000 });

    // When key is configured, the page shows the provider and config fields
    await expect(page.getByText("已选:")).toBeVisible();
    await expect(page.getByText("API 地址")).toBeVisible();
    await expect(page.getByText("模型", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "验证并保存" })).toBeVisible();
  });

  test("Story 9.1: key status indicator shows not-configured state", async ({ page }) => {
    await mockConfig(page, false);

    await page.goto(url("/books"));
    const { token } = await createTestUser(page);
    await setToken(page, token);

    await page.goto(url("/config"));
    await expect(page.getByRole("heading", { name: "AI 模型配置" })).toBeVisible({ timeout: 10000 });

    // No "已选:" badge means no provider configured yet
    await expect(page.getByText("已选:")).not.toBeVisible();
  });
});

test.describe("Account — Dashboard License & Tier Info", () => {
  // -----------------------------------------------------------------------
  // Story 9.2: 查看 License 到期
  // -----------------------------------------------------------------------

  test("Story 9.2: dashboard shows free tier banner when tier is none", async ({ page }) => {
    // Mock config to prevent redirect to /config
    await mockConfig(page, true);
    // Mock verify to return free tier
    await mockVerify(page, "none", 7);
    // Mock projects to return empty list
    await page.route("**/api/projects", async (route: any) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      } else {
        await route.continue();
      }
    });

    await page.goto(url("/books"));
    const { token } = await createTestUser(page);
    await setToken(page, token);

    await page.goto(url("/books"));
    await expect(page.getByRole("heading", { name: "我的作品" })).toBeVisible({ timeout: 10000 });

    // Free tier banner should show trial days
    await expect(page.getByText("AI 试用还剩")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("link", { name: "了解套餐" })).toBeVisible();
  });

  test("Story 9.2: free tier info shows trial expiration notice", async ({ page }) => {
    await mockConfig(page, true);
    await mockVerify(page, "none", 0);

    await page.goto(url("/books"));
    const { token } = await createTestUser(page);
    await setToken(page, token);

    await page.goto(url("/books"));
    await expect(page.getByRole("heading", { name: "我的作品" })).toBeVisible({ timeout: 10000 });

    // When trial is 0, the banner shows "AI 试用已到期"
    await expect(page.getByText("AI 试用已到期")).toBeVisible({ timeout: 10000 });
  });

  test("Story 9.2: create project button visible for free tier with 0 projects", async ({ page }) => {
    await mockConfig(page, true);
    await mockVerify(page, "none", 7);

    await page.route("**/api/projects", async (route: any) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      } else {
        await route.continue();
      }
    });

    await page.goto(url("/books"));
    const { token } = await createTestUser(page);
    await setToken(page, token);

    await page.goto(url("/books"));
    await expect(page.getByRole("heading", { name: "我的作品" })).toBeVisible({ timeout: 10000 });

    // Free tier with 0 projects should still show the create button
    await expect(page.getByRole("button", { name: "开始新小说" })).toBeVisible();
  });
});

test.describe("Account — Reset Password", () => {
  test("Story S6.1: reset password page renders", async ({ page }) => {
    await page.goto(url("/reset-password"));
    await expect(page.getByRole("heading", { name: "重置密码" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("用户名")).toBeVisible();
    await expect(page.getByText("返回登录")).toBeVisible();
  });

  test("Story S6.1: reset password username step transitions to answer step", async ({ page }) => {
    await page.goto(url("/reset-password"));
    await expect(page.getByRole("heading", { name: "重置密码" })).toBeVisible({ timeout: 10000 });

    // Enter username and click next
    await page.locator(".card-body input").first().fill("test_user");
    await page.getByRole("button", { name: "下一步" }).click();

    // Should now show answer fields
    await expect(page.getByText("密保答案")).toBeVisible();
    await expect(page.getByText("新密码")).toBeVisible();
    await expect(page.getByRole("button", { name: "重置" })).toBeVisible();
  });

  test("Story S6.1: empty username shows validation error", async ({ page }) => {
    await page.goto(url("/reset-password"));
    await expect(page.getByRole("heading", { name: "重置密码" })).toBeVisible({ timeout: 10000 });

    // Click next without entering username
    await page.getByRole("button", { name: "下一步" }).click();
    await expect(page.getByText("请输入用户名")).toBeVisible();
  });
});
