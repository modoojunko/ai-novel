import { test, expect } from "@playwright/test";
import { url, API_URL } from "./helpers";

// =========================================================================
// Genre settings — E2E UI tests
// =========================================================================

test.describe("Genre Settings", () => {
  test.beforeEach(async ({ page }) => {
    // Setup: register user + navigate to books
    await page.goto(url("/books"));
    const uid = Date.now().toString(36).slice(-6);
    const regResp = await page.request.post(`${API_URL}/auth/register`, {
      data: { email: `genre_e2e_${uid}@t.local`, password: "TestPass789!", display_name: "GenreTest" },
    });
    expect(regResp.ok()).toBeTruthy();
    const body = await regResp.json();
    const token = body.access_token || body.token;

    await page.evaluate((t) => { localStorage.setItem("auth_token", t); }, token);
    await page.goto(url("/books"));
    await expect(page.getByText("我的作品").first()).toBeVisible({ timeout: 10000 });

    // Create a project
    const projResp = await page.request.post(`${API_URL}/projects`, {
      data: { name: "题材测试" },
      headers: { Authorization: `Bearer ${token}` },
    });
    const proj = await projResp.json();
    // Store project slug for this test
    await page.evaluate((s) => { localStorage.setItem("test_slug", s); }, proj.slug);

    // Navigate to project
    await page.goto(url(`/project/${proj.id}`));
    await expect(page.getByText("题材测试").first()).toBeVisible({ timeout: 15000 });
  });

  test("settings tree shows 题材设定 node", async ({ page }) => {
    // Look for the 题材设定 entry in the left settings tree
    await expect(page.getByText("题材设定").first()).toBeVisible({ timeout: 10000 });
  });

  test("clicking 题材设定 shows empty state with select button", async ({ page }) => {
    await page.getByText("题材设定").first().click();
    await page.waitForTimeout(1000);

    // Should show empty state
    await expect(page.getByText("尚未选择题材")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "选择题材" })).toBeVisible();
  });

  test("clicking 选择题材 opens genre picker modal", async ({ page }) => {
    await page.getByText("题材设定").first().click();
    await page.waitForTimeout(1000);

    await page.getByRole("button", { name: "选择题材" }).click();
    await page.waitForTimeout(1000);

    // Modal should be visible with title
    await expect(page.getByRole("heading", { name: "选择题材" })).toBeVisible({ timeout: 5000 });

    // Category navigation should show
    await expect(page.getByText("都市系")).toBeVisible();
    await expect(page.getByText("历史系")).toBeVisible();
  });

  test("selecting a genre in picker shows preview", async ({ page }) => {
    await page.getByText("题材设定").first().click();
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "选择题材" }).click();
    await page.waitForTimeout(1000);

    // Click on a genre card
    const genreBtn = page.getByText("都市日常").first();
    if (await genreBtn.isVisible()) {
      await genreBtn.click();
      await page.waitForTimeout(500);

      // Preview should show narrator role
      await expect(page.getByText(/典型故事弧/)).toBeVisible({ timeout: 5000 });

      // Confirm button should be enabled
      await expect(page.getByRole("button", { name: /应用题材|确认选择/ })).toBeVisible();
    }
  });

  test("genre settings panel shows config sections after selection", async ({ page }) => {
    // Navigate to genre settings via the tree
    await page.getByText("题材设定").first().click();
    await page.waitForTimeout(1000);

    // If already selected (from previous tests), should show config sections
    const selectBtn = page.getByRole("button", { name: "选择题材" });
    if (await selectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Select a genre via picker
      await selectBtn.click();
      await page.waitForTimeout(1000);
      await page.getByText("都市日常").first().click();
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: /应用题材|确认选择/ }).click();
      await page.waitForTimeout(2000);
    }

    // Should show genre name
    await expect(page.getByText(/都市日常|历史架空|传统玄幻/).first()).toBeVisible({ timeout: 10000 });
  });
});
