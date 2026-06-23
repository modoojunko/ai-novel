import { test, expect } from "@playwright/test";
import { url, setupProjectPage } from "./helpers";

test.describe("AI Settings — global generate", () => {
  test("一键生成 all button visible on settings panel", async ({ page }) => {
    await setupProjectPage(page);
    // Project page opens on 设定 tab by default for new projects
    await expect(page.getByText("AI 一键生成全部设定")).toBeVisible();
  });

  test("button has Lucide Sparkles icon", async ({ page }) => {
    await setupProjectPage(page);
    const btn = page.getByText("AI 一键生成全部设定");
    await expect(btn.locator("svg").first()).toBeVisible();
  });

  test("clicking generates opens progress modal showing setting types", async ({ page }) => {
    await page.route("**/api/projects/**/settings/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
    });
    await setupProjectPage(page);
    await page.getByText("AI 一键生成全部设定").click();
    // Scope to modal-box since "世界设定" and "写作风格" also exist in the sidebar
    const modal = page.locator(".modal-box");
    await expect(modal.getByText("世界设定")).toBeVisible();
    await expect(modal.getByText("写作风格")).toBeVisible();
  });
});

test.describe("AI Settings — per-field generation", () => {
  test.beforeEach(async ({ page }) => {
    await setupProjectPage(page);
  });

  test("world setting fields have AI 帮我填 button", async ({ page }) => {
    // Click on 世界设定 tree item
    await page.getByText("世界设定").first().click();
    // Wait for the form to load
    await page.waitForTimeout(1000);
    // Check that "AI 帮我填" buttons exist
    const aiBtns = page.getByText("AI 帮我填");
    await expect(aiBtns.first()).toBeVisible();
    // Should have multiple AI buttons (one per field)
    const count = await aiBtns.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("clicking AI button opens suggestion modal", async ({ page }) => {
    // Mock the AI field endpoint
    await page.route("**/api/projects/**/settings/ai/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ value: "AI生成的测试内容" }),
      });
    });

    await page.getByText("世界设定").first().click();
    await page.waitForTimeout(1000);
    await page.getByText("AI 帮我填").first().click();
    // Modal should appear
    await expect(page.getByText("AI 建议")).toBeVisible({ timeout: 10000 });
  });

  test("accept button fills content and closes modal", async ({ page }) => {
    await page.route("**/api/projects/**/settings/ai/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ value: "可接受的内容" }),
      });
    });

    await page.getByText("世界设定").first().click();
    await page.waitForTimeout(1000);
    await page.getByText("AI 帮我填").first().click();
    await expect(page.getByText("AI 建议")).toBeVisible({ timeout: 10000 });
    // Wait for content to load
    await page.waitForTimeout(500);
    // Click accept
    await page.getByText("接受这个").click();
    // Modal should close
    await expect(page.getByText("AI 建议")).not.toBeVisible();
  });

  test("retry button re-triggers generation", async ({ page }) => {
    let callCount = 0;
    await page.route("**/api/projects/**/settings/ai/**", async (route) => {
      callCount++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ value: `尝试${callCount}` }),
      });
    });

    await page.getByText("世界设定").first().click();
    await page.waitForTimeout(1000);
    await page.getByText("AI 帮我填").first().click();
    await expect(page.getByText("AI 建议")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Click "换一个"
    await page.getByText("换一个").click();
    await page.waitForTimeout(500);
    // Should have been called twice
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  test("anti-ai tab has no AI buttons", async ({ page }) => {
    await page.getByText("反AI规则").click();
    const aiBtns = page.getByText("AI 帮我填");
    await expect(aiBtns).toHaveCount(0);
  });
});
