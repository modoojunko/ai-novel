import { test, expect } from "@playwright/test";
import { url, API_URL, createTestUser, setToken } from "./helpers";

async function createProject(browser: any) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(url("/books"));
  const { token } = await createTestUser(page);
  await setToken(page, token);
  const name = `E2E_${Date.now()}`;
  const resp = await page.request.post(`${API_URL}/projects`, {
    data: { name },
    headers: { Authorization: `Bearer ${token}` },
  });
  const project = await resp.json();
  await ctx.close();
  return { token, slug: project.slug };
}

// =========================================================================
// Project page - empty project
// =========================================================================

test.describe("Project page - empty project", () => {
  let slug = "";
  let authToken = "";

  test.beforeAll(async ({ browser }) => {
    const result = await createProject(browser);
    slug = result.slug;
    authToken = result.token;
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(url("/books"));
    await setToken(page, authToken);
    await page.goto(url(`/project/${slug}`));
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
  });

  test("top bar shows project name and tabs", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("button", { name: "设定", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "正文" })).toBeVisible();
  });

  test("delete button visible in top bar", async ({ page }) => {
    await expect(page.locator('button[title="删除小说"]')).toBeVisible();
  });

  test("settings tab shows all 5 tree items", async ({ page }) => {
    await expect(page.getByText("世界设定").first()).toBeVisible();
    await expect(page.getByText("写作风格").first()).toBeVisible();
    await expect(page.getByText("反AI规则").first()).toBeVisible();
    await expect(page.getByText("伏笔面板").first()).toBeVisible();
    await expect(page.getByText("角色管理").first()).toBeVisible();
  });

  test("settings tree has Lucide SVG icons", async ({ page }) => {
    await expect(page.locator(".w-56 svg")).toHaveCount(5);
  });

  test("clicking a settings tree item opens panel", async ({ page }) => {
    await page.locator(".w-56").getByText("世界设定").click();
    await expect(page.getByText("世界设定").first()).toBeVisible();
  });

  test("正文 tab shows incomplete settings state", async ({ page }) => {
    await page.getByRole("button", { name: "正文" }).click();
    await expect(page.getByText("设定尚未全部完成")).toBeVisible();
  });

  test("theme toggle works", async ({ page }) => {
    await page.locator('.navbar button[title*="主题"]').click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "parchment");
  });

  test("page-enter animation present", async ({ page }) => {
    await expect(page.locator(".page-enter")).toBeVisible();
  });
});

// NOTE: Chapter editor tests (outline, writing, volume/chapter management)
// have been moved to outline.spec.ts and writing.spec.ts
