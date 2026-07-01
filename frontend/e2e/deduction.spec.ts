import { test, expect } from "@playwright/test";
import { url, API_URL, createTestUser, setToken } from "./helpers";

let sharedSlug = "";
let sharedToken = "";

test.describe("Story Deduction", () => {
  test.beforeAll(async ({ browser }) => {
    // Setup: create user + project + confirm settings
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(url("/dashboard"));
    const { token } = await createTestUser(page);
    sharedToken = token;
    await setToken(page, token);

    const pResp = await page.request.post(`${API_URL}/projects`, {
      data: { name: `DeductionE2E_${Date.now()}` },
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

  test("deduction tab is visible in top bar", async ({ page }) => {
    await expect(page.getByText("推演")).toBeVisible();
  });

  test("clicking deduction tab shows init button", async ({ page }) => {
    await page.getByText("推演").click();
    await expect(page.getByText("初始化推演")).toBeVisible();
  });

  test("clicking init shows seed modal when no missing items", async ({ page }) => {
    // Mock the init API
    await page.route("**/api/story/init", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          deduction_id: "test-123",
          stage: { terrain: "测试场景", time: "白天", weather: "晴" },
          characters: ["角色A", "角色B"],
          missing: [],
        }),
      });
    });
    await page.getByText("推演").click();
    await page.getByText("初始化推演").click();
    // Should show seed input modal
    await expect(page.getByText("输入触发种子")).toBeVisible({ timeout: 10000 });
  });

  test("round controls appear after setting seed", async ({ page }) => {
    // Mock init
    await page.route("**/api/story/init", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          deduction_id: "test-456",
          stage: { terrain: "测试场景", time: "白天" },
          characters: ["A"],
          missing: [],
        }),
      });
    });
    // Mock seed
    await page.route("**/api/story/*/seed", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    // Mock round
    await page.route("**/api/story/*/round", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          round: 1,
          stage: { terrain: "测试", events: [{ actor: "A", action: "移动", result: "走了两步", visibility: "公开" }] },
          decisions: [{ character_id: "A", log: { action_type: "动作", action_description: "A向前走了两步", inner_monologue: "继续走" } }],
          characters: { A: { position: "前方", stamina: 90, emotion: "平静", urgency: "", knowledge: [] } },
        }),
      });
    });

    await page.getByText("推演").click();
    await page.getByText("初始化推演").click();
    await page.waitForTimeout(1000);

    // Fill and submit seed
    await page.getByPlaceholder("输入触发种子…").fill("测试开始");
    await page.getByText("开始推演").click();
    await page.waitForTimeout(2000);

    // Should show round controls
    await expect(page.getByText("下一回合")).toBeVisible();
  });
});
