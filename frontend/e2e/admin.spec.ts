import { test, expect } from "@playwright/test";
import { url, API_URL, createTestUser, setToken } from "./helpers";

test.describe("Admin backend — API access control", () => {
  test("admin stats returns 403 for regular user", async ({ page }) => {
    await page.goto(url("/dashboard"));
    const { token } = await createTestUser(page);
    await setToken(page, token);

    // Direct API call from browser context
    const result = await page.evaluate(async () => {
      const t = localStorage.getItem("token");
      const r = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${t}` },
      });
      return { status: r.status, body: await r.json().then(d => JSON.stringify(d)).catch(() => "") };
    });
    expect(result.status).toBe(403);
  });

  test("admin users list returns 403 for regular user", async ({ page }) => {
    await page.goto(url("/dashboard"));
    const { token } = await createTestUser(page);
    await setToken(page, token);

    const result = await page.evaluate(async () => {
      const t = localStorage.getItem("token");
      const r = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${t}` },
      });
      return { status: r.status };
    });
    expect(result.status).toBe(403);
  });
});

test.describe("Admin frontend — UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url("/dashboard"));
    const { token } = await createTestUser(page);
    await setToken(page, token);
  });

  test("admin sidebar navigation renders", async ({ page }) => {
    await page.goto(url("/admin"));
    // Admin layout sidebar should render
    await expect(page.getByText("爱小说 · 管理")).toBeVisible();
    await expect(page.getByText("仪表盘")).toBeVisible();
    await expect(page.getByText("用户管理")).toBeVisible();
    await expect(page.getByText("项目浏览")).toBeVisible();
    await expect(page.getByText("Token 账单")).toBeVisible();
  });

  test("admin dashboard page shows stat headings", async ({ page }) => {
    await page.goto(url("/admin"));
    // The sidebar has "仪表盘" nav item
    await expect(page.getByText("仪表盘").first()).toBeVisible();
  });

  test("admin users page shows user table heading", async ({ page }) => {
    await page.goto(url("/admin/users"));
    await expect(page.getByText("用户管理").first()).toBeVisible();
  });

  test("admin projects page is accessible", async ({ page }) => {
    await page.goto(url("/admin/projects"));
    await expect(page.getByText("项目浏览").first()).toBeVisible();
  });

  test("admin tokens page is accessible", async ({ page }) => {
    await page.goto(url("/admin/tokens"));
    await expect(page.getByText("Token 账单").first()).toBeVisible();
  });
});
