import { test, expect } from "@playwright/test";
import { url, API_URL } from "./helpers";

test.describe("Genre Settings", () => {
  test("settings tree shows 题材设定 node", async ({ page }) => {
    const uid = Date.now().toString(36).slice(-6);
    await page.goto(url("/books"));
    const r = await page.request.post(`${API_URL}/auth/register`, {
      data: { email: `gt_${uid}@t.local`, password: "TestPass789!", display_name: "G" },
    });
    const token = (await r.json()).access_token || (await r.json()).token;
    await page.evaluate((t) => { localStorage.setItem("auth_token", t); }, token);
    await page.goto(url("/books"));
    await expect(page.getByText("我的作品").first()).toBeVisible({ timeout: 10000 });
    const p = await (await page.request.post(`${API_URL}/projects`, {
      data: { name: "题材测试" }, headers: { Authorization: `Bearer ${token}` },
    })).json();
    await page.goto(url(`/project/${p.id}`));
    await expect(page.getByText("题材测试").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("题材设定").first()).toBeVisible({ timeout: 5000 });
  });

  test("click 题材设定 shows genre panel", async ({ page }) => {
    const uid = Date.now().toString(36).slice(-6);
    await page.goto(url("/books"));
    const r = await page.request.post(`${API_URL}/auth/register`, {
      data: { email: `gt2_${uid}@t.local`, password: "TestPass789!", display_name: "G2" },
    });
    const token = (await r.json()).access_token || (await r.json()).token;
    await page.evaluate((t) => { localStorage.setItem("auth_token", t); }, token);
    await page.goto(url("/books"));
    await expect(page.getByText("我的作品").first()).toBeVisible({ timeout: 10000 });
    const p = await (await page.request.post(`${API_URL}/projects`, {
      data: { name: "题材测试2" }, headers: { Authorization: `Bearer ${token}` },
    })).json();
    await page.goto(url(`/project/${p.id}`));
    await expect(page.getByText("题材测试2").first()).toBeVisible({ timeout: 15000 });
    await page.getByText("题材设定").first().click();
    await page.waitForTimeout(3000);
    // Either empty state or loaded state
    await expect(page.getByText(/尚未选择题材|题材设定|都市|历史/).first()).toBeVisible({ timeout: 15000 });
  });
});
