import { test, expect } from "@playwright/test";
import { url, createTestUser, setToken } from "./helpers";

// =========================================================================
// NOTE: C端 是单机桌面端，没有管理后台功能。
// 管理后台（用户管理、码管理、统计）属于 S端 Web 平台，
// 在 server/ 目录下通过 http://localhost:19000/admin 访问。
// =========================================================================

test.describe("Navbar — logged in state", () => {
  test("navbar shows 我的作品 link when logged in", async ({ page }) => {
    await page.goto(url("/books"));
    const { token } = await createTestUser(page);
    await setToken(page, token);
    await page.goto(url("/books"));
    await expect(page.getByRole("link", { name: "我的作品" })).toBeVisible();
  });
});
