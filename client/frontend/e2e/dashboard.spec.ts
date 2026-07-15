import { test, expect } from "@playwright/test";
import {
  url,
  API_URL,
  setupAuthAndNavigate,
  createTestUser,
  setToken,
} from "./helpers";

// =========================================================================
// Dashboard — requires authenticated user
// =========================================================================

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthAndNavigate(page, "/dashboard");
    // Wait for the dashboard to fully render
    await page.waitForSelector("h1", { timeout: 10000 });
  });

  test("page title and create button visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "我的小说" })).toBeVisible();
    await expect(page.getByRole("button", { name: "开始新小说" })).toBeVisible();
  });

  test("navbar visible with logo and theme toggle", async ({ page }) => {
    await expect(page.locator(".navbar")).toBeVisible();
    await expect(page.locator(".navbar").getByText("爱小说")).toBeVisible();
    await expect(
      page.locator('.navbar button[title*="主题"] svg')
    ).toBeVisible();
  });

  test("theme toggle works on dashboard", async ({ page }) => {
    await page.locator('.navbar button[title*="主题"]').click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "parchment");
  });

  test("page-enter animation present", async ({ page }) => {
    await expect(page.locator(".page-enter")).toBeVisible();
  });

  test("shows empty state when no projects exist", async ({ page }) => {
    // Fresh user has no projects
    await expect(page.getByText("暂无小说")).toBeVisible();
  });

  test("create project modal opens", async ({ page }) => {
    await page.getByRole("button", { name: "开始新小说" }).click();
    await expect(page.locator(".modal-box")).toBeVisible();
    await expect(page.getByText("开始一部新小说")).toBeVisible();
  });

  test("create project via manual mode", async ({ page }) => {
    await page.getByRole("button", { name: "开始新小说" }).click();
    await page.getByText("我已经有书名和想法了").click();
    const projectName = `E2E测试_${Date.now()}`;
    await page.getByPlaceholder("给你的小说取个名字…").fill(projectName);
    await page.getByRole("button", { name: "创建" }).click();
    // Should navigate to project page
    await expect(page).toHaveURL(/#\/project\//);
  });

  // Project creation via manual mode is covered in test above
});

test.describe("Dashboard — project navigation", () => {
  test("clicking project card navigates to project page", async ({
    page,
  }) => {
    const { token } = await createTestUser(page);
    await page.goto(url("/dashboard"));
    await setToken(page, token);

    const name = `NavTest_${Date.now()}`;
    await page.request.post(`${API_URL}/projects`, {
      data: { name },
      headers: { Authorization: `Bearer ${token}` },
    });
    await page.goto(url("/dashboard"));
    await page.waitForSelector("h1", { timeout: 10000 });

    await page.getByText(name).click();
    await expect(page).toHaveURL(/#\/project\//);
  });
});
