import { test, expect } from "@playwright/test";
import { url, API_URL, createTestUser, setToken } from "./helpers";

let sharedSlug = "";
let sharedToken = "";

test.describe("AI Chapter Writing", () => {
  test.beforeAll(async ({ browser }) => {
    // Setup: create user + project + volume + chapter + confirm settings
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(url("/dashboard"));
    const { token } = await createTestUser(page);
    sharedToken = token;
    await setToken(page, token);

    const pResp = await page.request.post(`${API_URL}/projects`, {
      data: { name: `WritingE2E_${Date.now()}` },
      headers: { Authorization: `Bearer ${token}` },
    });
    const project = await pResp.json();
    sharedSlug = project.slug;

    const bySlug = await page.request.get(`${API_URL}/projects/by-slug/${sharedSlug}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { id: projectId } = await bySlug.json();

    // Write settings to pass gate
    await page.request.put(`${API_URL}/projects/${projectId}/settings/world`, {
      data: { a: "1", b: "2", c: "3", d: "4", e: "5" },
      headers: { Authorization: `Bearer ${token}` },
    });
    await page.request.put(`${API_URL}/projects/${projectId}/settings/style`, {
      data: { role: "writer" },
      headers: { Authorization: `Bearer ${token}` },
    });
    await page.request.put(`${API_URL}/projects/${projectId}/settings/hooks`, {
      data: { active: [{ x: "1" }, { x: "2" }, { x: "3" }] },
      headers: { Authorization: `Bearer ${token}` },
    });
    await page.waitForTimeout(2000);
    for (const st of ["world", "style", "anti-ai", "hooks", "characters"]) {
      await page.request.put(`${API_URL}/projects/${projectId}/settings/status/${st}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    // Create volume + chapter
    await page.request.post(`${API_URL}/projects/${projectId}/volumes`, {
      data: { title: "V1", vol_num: 1 },
      headers: { Authorization: `Bearer ${token}` },
    });
    await page.request.post(`${API_URL}/projects/${projectId}/chapters`, {
      data: { volume: 1, chapter: 1, title: "第一章" },
      headers: { Authorization: `Bearer ${token}` },
    });
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
    // Switch to 正文 tab
    await page.getByRole("button", { name: "正文" }).click();
    await page.waitForTimeout(1500);
  });

  test("view tabs (正文/提示词) are visible in chapter editor", async ({ page }) => {
    const tree = page.locator(".w-56");
    await expect(tree.getByText("第1卷")).toBeVisible({ timeout: 10000 });
    await expect(tree.getByText("第一章")).toBeVisible({ timeout: 5000 });
    await tree.getByText("第一章").click();
    await expect(page.locator("h2")).toContainText("第一章", { timeout: 15000 });

    await expect(page.getByText("提示词")).toBeVisible();
  });

  test("AI write button is visible in prose tab", async ({ page }) => {
    const tree = page.locator(".w-56");
    await expect(tree.getByText("第1卷")).toBeVisible({ timeout: 10000 });
    await tree.getByText("第一章").click();
    await expect(page.locator("h2")).toContainText("第一章", { timeout: 15000 });

    await expect(page.getByText(/AI.*写本章/)).toBeVisible();
  });

  test("switching to 提示词 tab shows prompt viewer", async ({ page }) => {
    const tree = page.locator(".w-56");
    await expect(tree.getByText("第1卷")).toBeVisible({ timeout: 10000 });
    await tree.getByText("第一章").click();
    await expect(page.locator("h2")).toContainText("第一章", { timeout: 15000 });

    await page.getByText("提示词").click();
    await expect(page.locator("pre").first()).toBeVisible();
  });

  test("quality check button is visible", async ({ page }) => {
    const tree = page.locator(".w-56");
    await expect(tree.getByText("第1卷")).toBeVisible({ timeout: 10000 });
    await tree.getByText("第一章").click();
    await expect(page.locator("h2")).toContainText("第一章", { timeout: 15000 });
    await expect(page.getByText("质量检查")).toBeVisible();
  });

  test("archive button is visible", async ({ page }) => {
    const tree = page.locator(".w-56");
    await expect(tree.getByText("第1卷")).toBeVisible({ timeout: 10000 });
    await tree.getByText("第一章").click();
    await expect(page.locator("h2")).toContainText("第一章", { timeout: 15000 });
    // "归档" matches both status dropdown option and the archive button - use specific role
    await expect(page.getByRole("button", { name: "归档" })).toBeVisible();
  });

  test("history button is visible", async ({ page }) => {
    const tree = page.locator(".w-56");
    await expect(tree.getByText("第1卷")).toBeVisible({ timeout: 10000 });
    await tree.getByText("第一章").click();
    await expect(page.locator("h2")).toContainText("第一章", { timeout: 15000 });
    await expect(page.getByText("历史版本")).toBeVisible();
  });
});
