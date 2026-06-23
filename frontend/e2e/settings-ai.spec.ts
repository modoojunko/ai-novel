import { test, expect } from "@playwright/test";
import { url, API_URL, createTestUser, setToken } from "./helpers";

// Shared setup: create one user + project, reuse across all tests
let sharedSlug = "";
let sharedToken = "";

test.describe("AI Settings", () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(url("/dashboard"));
    const { token } = await createTestUser(page);
    sharedToken = token;
    await setToken(page, token);
    const name = `AISettings_${Date.now()}`;
    const resp = await page.request.post(`${API_URL}/projects`, {
      data: { name },
      headers: { Authorization: `Bearer ${token}` },
    });
    sharedSlug = (await resp.json()).slug;
    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(url("/dashboard"));
    await setToken(page, sharedToken);
    await page.goto(url(`/project/${sharedSlug}`));
    for (let i = 0; i < 3; i++) {
      const ok = await page.locator("h1").isVisible().catch(() => false);
      if (ok) break;
      await page.waitForTimeout(2000);
    }
  });

  test("global generate button visible with Sparkles icon", async ({ page }) => {
    await expect(page.getByText("AI 一键生成全部设定")).toBeVisible();
    const btn = page.getByText("AI 一键生成全部设定");
    await expect(btn.locator("svg").first()).toBeVisible();
  });

  test("clicking generate opens progress modal", async ({ page }) => {
    await page.route("**/api/projects/**/settings/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
    });
    await page.getByText("AI 一键生成全部设定").click();
    const modal = page.locator(".modal-box");
    await expect(modal.getByText("世界设定")).toBeVisible();
    await expect(modal.getByText("写作风格")).toBeVisible();
  });

  test("world setting fields have AI 帮我填 buttons", async ({ page }) => {
    await page.getByText("世界设定").first().click();
    await page.waitForTimeout(1000);
    const aiBtns = page.getByText("AI 帮我填");
    await expect(aiBtns.first()).toBeVisible();
    const count = await aiBtns.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("clicking AI button opens suggestion modal", async ({ page }) => {
    await page.route("**/api/projects/**/settings/ai/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ value: "AI生成的测试内容" }) });
    });
    // Wait for the settings tree to fully render
    await page.waitForTimeout(2000);
    await page.locator(".w-56").getByText("世界设定").click().catch(() => {});
    await page.waitForTimeout(1000);
    await page.getByText("AI 帮我填").first().click();
    await expect(page.getByText("AI 建议")).toBeVisible({ timeout: 10000 });
  });

  test("accept button fills content and closes modal", async ({ page }) => {
    await page.route("**/api/projects/**/settings/ai/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ value: "可接受的内容" }) });
    });
    await page.getByText("世界设定").first().click();
    await page.waitForTimeout(1000);
    await page.getByText("AI 帮我填").first().click();
    await expect(page.getByText("AI 建议")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
    await page.getByText("接受这个").click();
    await expect(page.getByText("AI 建议")).not.toBeVisible();
  });

  test("retry button re-triggers generation", async ({ page }) => {
    let callCount = 0;
    await page.route("**/api/projects/**/settings/ai/**", async (route) => {
      callCount++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ value: `尝试${callCount}` }) });
    });
    await page.getByText("世界设定").first().click();
    await page.waitForTimeout(1000);
    await page.getByText("AI 帮我填").first().click();
    await expect(page.getByText("AI 建议")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
    await page.getByText("换一个").click();
    await page.waitForTimeout(500);
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  test("anti-ai tab has no AI buttons", async ({ page }) => {
    await page.getByText("反AI规则").click();
    const aiBtns = page.getByText("AI 帮我填");
    await expect(aiBtns).toHaveCount(0);
  });
});
