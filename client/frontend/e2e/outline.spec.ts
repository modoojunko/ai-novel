import { test, expect } from "@playwright/test";
import { url, API_URL, createTestUser, setToken } from "./helpers";

// ---------------------------------------------------------------------------
// Helpers — fill a Field (label + textarea/input pair) by label text
// ---------------------------------------------------------------------------

async function fillFieldByLabel(
  page: import("@playwright/test").Page,
  labelText: string,
  value: string
) {
  // The Field component renders: wrapper div > label row div > label + button
  //                                       > textarea
  const wrapper = page
    .locator("div")
    .filter({ has: page.locator(`label:has-text("${labelText}")`) })
    .first();
  await wrapper.locator("textarea, input").first().fill(value);
}

async function clickSave(page: import("@playwright/test").Page) {
  // Each settings form has a "💾 保存" button in the TabBar
  const btn = page.locator('button:has-text("保存")').filter({
    hasNotText: "保存中",
  });
  await btn.click();
  // Wait for save to complete (button becomes "💾 保存" again)
  await expect(btn).toBeEnabled({ timeout: 10000 });
}

async function confirmSetting(page: import("@playwright/test").Page) {
  // Click "标记完成" button (ConfirmToggle), then wait for it to become "已完成"
  const toggle = page.getByText("标记完成");
  await toggle.click();
  await expect(page.getByText("已完成")).toBeVisible({ timeout: 10000 });
}

// =========================================================================
// Phase 3: Outline — volume and chapter outline management
// =========================================================================

test.describe("Phase 3: Outline — volume and chapter outline", () => {
  test.setTimeout(60000);
  let slug = "";
  let authToken = "";

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // ── 1. User + auth ───────────────────────────────────────────────
    await page.goto(url("/books"));
    const { token } = await createTestUser(page);
    authToken = token;
    await setToken(page, token);

    // ── 2. API key (Dashboard prerequisite) ──────────────────────────
    await page.request.post(`${API_URL}/auth/config/api-key`, {
      data: { api_key: "e2e-test-key", api_base_url: "", api_model: "haiku" },
    });

    // ── 3. Create project through UI ─────────────────────────────────
    await page.goto(url("/books"));
    await expect(page.getByRole("heading", { name: "我的作品" })).toBeVisible({ timeout: 15000 });

    const projectName = `E2E_Outline_${Date.now()}`;
    await page.getByRole("button", { name: "开始新小说" }).click();
    await page.getByText("我已经有书名和想法了").click();
    await page.getByPlaceholder("给你的小说取个名字…").fill(projectName);
    await page.getByRole("button", { name: "创建" }).click();
    await page.waitForURL(/#\/project\//, { timeout: 15000 });

    // Extract slug from URL
    const currentUrl = page.url();
    slug = currentUrl.split("/project/")[1] || "";

    // ── 4. Complete all 5 settings through UI ────────────────────────
    // NovelPage auto-shows settings tab for new projects

    // 4a. 世界设定 (world) — fill fields, save, confirm
    await page.locator(".w-56").getByText("世界设定").click();
    await expect(page.getByText("主要场景")).toBeVisible({ timeout: 15000 });
    await fillFieldByLabel(page, "主要场景", "中世纪低魔世界，多个王国");
    await fillFieldByLabel(page, "气候", "温带大陆性气候");
    await fillFieldByLabel(page, "地理限制", "北部山脉隔绝北方");
    await page.getByRole("button", { name: "政治" }).click();
    await fillFieldByLabel(page, "统治形式", "封建君主制");
    await fillFieldByLabel(page, "主要势力", "王国、教会、佣兵公会");
    await clickSave(page);
    await confirmSetting(page);

    // 4b. 写作风格 (style) — fill role field, save, confirm
    await page.locator(".w-56").getByText("写作风格").click();
    await expect(page.getByText("叙事身份")).toBeVisible({ timeout: 15000 });
    await fillFieldByLabel(page, "叙事身份", "有限第三人称，主角视角");
    await clickSave(page);
    await confirmSetting(page);

    // 4c. 反AI规则 (anti-ai) — save (empty is valid), confirm
    await page.locator(".w-56").getByText("反AI规则").click();
    await expect(page.getByText("疲劳词")).toBeVisible({ timeout: 15000 });
    await clickSave(page);
    await confirmSetting(page);

    // 4d. 伏笔面板 (hooks) — save (empty is valid), confirm
    await page.locator(".w-56").getByText("伏笔面板").click();
    await expect(page.getByText("活跃伏笔")).toBeVisible({ timeout: 15000 });
    await clickSave(page);
    await confirmSetting(page);

    // 4e. 角色管理 (characters) — confirm only (no character needed)
    await page.locator(".w-56").getByText("角色管理").click();
    await expect(page.getByText("标记完成")).toBeVisible({ timeout: 15000 });
    await confirmSetting(page);

    // ── 5. Navigate to 正文 tab ──────────────────────────────────────
    await page.getByRole("button", { name: "正文" }).click();
    await expect(page.getByText("创建第一卷")).toBeVisible({ timeout: 15000 });

    // ── 6. Create volume through UI ──────────────────────────────────
    // Empty state shows "创建第一卷" button (settingsComplete = true)
    await page.getByText("创建第一卷").click();
    await expect(page.getByText("卷纲")).toBeVisible({ timeout: 15000 });

    // ── 7. Fill volume title and outline ────────────────────────────
    const volInput = page.locator('input[placeholder="卷名"]');
    await volInput.fill("第一卷");
    const volSummary = page.locator('textarea[placeholder*="卷纲"]');
    await volSummary.fill("主角从佣兵开始，逐步卷入王国纷争");

    // ── 8. Create chapter through UI ────────────────────────────────
    await page.getByRole("button", { name: "添加章节" }).click();
    // After creation, VolumeEditor reloads and navigates to the new chapter
    await expect(page.locator("h2")).toBeVisible({ timeout: 15000 });

    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to project page and open 正文 tab
    await page.goto(url("/books"));
    await setToken(page, authToken);
    await page.goto(url(`/project/${slug}`));
    // Wait for page to render
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "正文" }).click();
  });

  // ────────────────────────────────────────────────────────────────────
  // Story 5.1 + 5.2: Volume and chapter appear in the tree
  // ────────────────────────────────────────────────────────────────────

  test("volume and chapter appear in writing tree", async ({ page }) => {
    const tree = page.locator(".w-56");
    await expect(tree.getByText("第1卷")).toBeVisible({ timeout: 15000 });
    // First volume shows chapter count badge
    await expect(tree.getByText("1章")).toBeVisible({ timeout: 5000 });
    // Chapter title visible in tree
    await expect(tree.getByText("第1章")).toBeVisible({ timeout: 5000 });
  });

  test("click chapter opens editor with correct title", async ({ page }) => {
    const tree = page.locator(".w-56");
    await expect(tree.getByText("第1卷")).toBeVisible({ timeout: 15000 });
    await expect(tree.getByText("第1章")).toBeVisible({ timeout: 5000 });
    await tree.getByText("第1章").click();
    await expect(page.locator("h2")).toContainText("第1章", { timeout: 15000 });
  });

  // ────────────────────────────────────────────────────────────────────
  // Story 5.3: Write outline (章纲)
  // ────────────────────────────────────────────────────────────────────

  test("outline textarea is visible and editable", async ({ page }) => {
    await page.locator(".w-56").getByText("第1章").click();
    await expect(page.locator("h2")).toContainText("第1章", { timeout: 15000 });

    const outline = page.getByPlaceholder("章纲（概述本章情节走向）");
    await expect(outline).toBeVisible();
    await outline.fill("主角接下第一个佣兵任务");
    await expect(outline).toHaveValue("主角接下第一个佣兵任务");
  });

  test("outline content persists after page reload", async ({ page }) => {
    // Open chapter, write outline content
    await page.locator(".w-56").getByText("第1章").click();
    await expect(page.locator("h2")).toContainText("第1章", { timeout: 15000 });

    const outline = page.getByPlaceholder("章纲（概述本章情节走向）");
    await outline.fill("主角在酒馆遇到神秘委托人");
    // Wait for auto-save (3s debounce) by listening for the PUT request
    await page.waitForResponse(
      (r) => r.url().includes("/chapters/") && r.request().method() === "PUT" && r.status() === 200,
      { timeout: 15000 }
    );

    // Reload and navigate back
    await page.reload();
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "正文" }).click();
    await page.locator(".w-56").getByText("第1卷").click();
    await expect(page.locator(".w-56").getByText("第1章")).toBeVisible({ timeout: 5000 });
    await page.locator(".w-56").getByText("第1章").click();
    await expect(page.locator("h2")).toContainText("第1章", { timeout: 15000 });

    // Outline content should still be there
    await expect(outline).toHaveValue("主角在酒馆遇到神秘委托人");
  });

  // ────────────────────────────────────────────────────────────────────
  // Story 5.6: Chapter status management
  // ────────────────────────────────────────────────────────────────────

  test("status dropdown has outline as default value", async ({ page }) => {
    await page.locator(".w-56").getByText("第1章").click();
    await expect(page.locator("h2")).toContainText("第1章", { timeout: 15000 });
    await expect(page.locator("select").first()).toHaveValue("outline");
  });

  test("changing status persists after page reload", async ({ page }) => {
    await page.locator(".w-56").getByText("第1章").click();
    await expect(page.locator("h2")).toContainText("第1章", { timeout: 15000 });

    // Change status to writing
	    await page.locator("select").first().selectOption("writing");
    // Wait for auto-save by listening for the PUT request
    await page.waitForResponse(
      (r) => r.url().includes("/chapters/") && r.request().method() == "PUT" && r.status() == 200,
      { timeout: 15000 }
    );

    // Reload and navigate back
    await page.reload();
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "正文" }).click();
    await page.locator(".w-56").getByText("第1章").click();
    await expect(page.locator("h2")).toContainText("第1章", { timeout: 15000 });

    // Status should be writing
    await expect(page.locator("select").first()).toHaveValue("writing");
  });

  // ────────────────────────────────────────────────────────────────────
  // Chapter editor features (migrated from project.spec.ts)
  // ────────────────────────────────────────────────────────────────────

  test("prose textarea is editable", async ({ page }) => {
    await page.locator(".w-56").getByText("第1章").click();
    await expect(page.locator("h2")).toContainText("第1章", { timeout: 15000 });

    const prose = page.getByPlaceholder("正文（在此撰写小说内容）");
    await expect(prose).toBeVisible();
    await prose.fill("test prose content");
    await expect(prose).toHaveValue("test prose content");
  });

  test("word count updates on typing", async ({ page }) => {
    await page.locator(".w-56").getByText("第1章").click();
    await expect(page.locator("h2")).toContainText("第1章", { timeout: 15000 });

    await page.getByPlaceholder("正文（在此撰写小说内容）").fill("12345");
    // Wait for React state update
    // Wait for state update
    await expect(page.locator("span.tabular-nums").first()).toBeVisible({ timeout: 5000 });
    // Word count display in tabular-nums span
    await expect(page.locator("span.tabular-nums").first()).toContainText("5");
  });

  test("preview mode renders markdown", async ({ page }) => {
    await page.locator(".w-56").getByText("第1章").click();
    await expect(page.locator("h2")).toContainText("第1章", { timeout: 15000 });

    await page.getByPlaceholder("正文（在此撰写小说内容）").fill("**bold**");
    await page.getByTitle(/预览/).click();
    await expect(page.locator("strong")).toContainText("bold");
    await page.getByTitle(/编辑/).click();
    await expect(page.getByPlaceholder("正文（在此撰写小说内容）")).toBeVisible();
  });

  test("focus mode enters and exits", async ({ page }) => {
    await page.locator(".w-56").getByText("第1章").click();
    await expect(page.locator("h2")).toContainText("第1章", { timeout: 15000 });

    await page.getByTitle("专注模式").click();
    await expect(page.getByText("退出专注")).toBeVisible();
    await page.getByText("退出专注").click();
    await expect(page.locator("h2")).toBeVisible();
  });

  test("focus mode preserves content", async ({ page }) => {
    await page.locator(".w-56").getByText("第1章").click();
    await expect(page.locator("h2")).toContainText("第1章", { timeout: 15000 });

    await page
      .getByPlaceholder("正文（在此撰写小说内容）")
      .fill("focus mode content");
    await page.getByTitle("专注模式").click();
    await expect(page.getByText("focus mode content")).toBeVisible();
  });

  test("history button visible in editor", async ({ page }) => {
    await page.locator(".w-56").getByText("第1章").click();
    await expect(page.locator("h2")).toContainText("第1章", { timeout: 15000 });
    await expect(page.getByText("历史版本")).toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────────
  // Volume outline editor
  // ────────────────────────────────────────────────────────────────────

  test("volume outline textarea is editable", async ({ page }) => {
    await page.locator(".w-56").getByText("第1卷").click();
    await expect(page.getByText("卷纲")).toBeVisible({ timeout: 15000 });

    const summary = page.getByPlaceholder("卷纲（概述本卷情节走向）");
    await expect(summary).toBeVisible();
    await summary.fill("佣兵王国的崛起");
    await expect(summary).toHaveValue("佣兵王国的崛起");
  });

  test("volume title is editable", async ({ page }) => {
    await page.locator(".w-56").getByText("第1卷").click();
    await expect(page.getByText("卷纲")).toBeVisible({ timeout: 15000 });

    const volInput = page.locator('input[placeholder="卷名"]');
    await expect(volInput).toBeVisible();
    await volInput.fill("第一卷：崛起");
    await expect(volInput).toHaveValue("第一卷：崛起");
  });
});
