import { test, expect } from "@playwright/test";
import { url, API_URL, createTestUser, setToken } from "./helpers";

let sharedSlug = "";
let sharedToken = "";
let sharedProjectId = "";

test.describe("AI Chapter Writing", () => {
  test.setTimeout(60000);
  test.beforeAll(async ({ browser }) => {
    // Setup: create user + project + confirm all settings + create volume/chapter
    // Data preparation via API — fast, deterministic, parallel-safe
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(url("/books"));
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
    sharedProjectId = projectId;

    // Write all 5 settings to pass every phase gate
    await page.request.put(`${API_URL}/projects/${projectId}/settings/world`, {
      data: { era: "中世纪", geography: "大陆", society: "封建" },
      headers: { Authorization: `Bearer ${token}` },
    });
    await page.request.put(`${API_URL}/projects/${projectId}/settings/style`, {
      data: { role: "冷峻的叙事者", perspective: "第三人称" },
      headers: { Authorization: `Bearer ${token}` },
    });
    await page.request.put(`${API_URL}/projects/${projectId}/settings/anti-ai`, {
      data: { fatigue_words_zh: { category1: [] }, structural_tic_patterns: [] },
      headers: { Authorization: `Bearer ${token}` },
    });
    await page.request.put(`${API_URL}/projects/${projectId}/settings/hooks`, {
      data: { active: [{ name: "伏笔1", description: "desc" }] },
      headers: { Authorization: `Bearer ${token}` },
    });
    await page.request.put(`${API_URL}/projects/${projectId}/settings/characters`, {
      data: { characters: [] },
      headers: { Authorization: `Bearer ${token}` },
    });

    // Confirm all setting sections to unlock the writing phase
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
    await page.goto(url(`/project/${sharedSlug}`));
    await setToken(page, sharedToken);
    await page.goto(url(`/project/${sharedSlug}`));
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "正文" }).click();

    // Click the chapter node in the writing tree to open the editor
    const tree = page.locator(".w-56");
    await expect(tree.getByText("第1卷")).toBeVisible({ timeout: 10000 });
    await tree.getByText("第一章").click();
    await expect(page.locator("h2")).toContainText("第一章", { timeout: 15000 });
  });

  // =========================================================================
  // Story 6.1-6.2: 提示词生成与管理 (Phase 4)
  // =========================================================================

  test("正文 and 提示词 view tabs are visible in chapter editor", async ({ page }) => {
    await expect(page.getByRole("button", { name: "正文" }).first()).toBeVisible();
    await expect(page.getByText("提示词")).toBeVisible();
  });

  test("switching to 提示词 tab shows prompt content in <pre> tag", async ({ page }) => {
    // Mock the prompt list and content endpoints — prompts require AI generation
    await page.route("**/api/projects/**/chapters/*/prompts", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(["vol-1-ch-1-seg-1-prompt.md"]),
      });
    });
    await page.route("**/api/projects/**/chapters/*/prompts/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: "这是第一章的提示词内容。\n\n请按照以下要求撰写正文。",
      });
    });

    await page.getByText("提示词").click();
    const pre = page.locator("pre");
    await expect(pre).toBeVisible({ timeout: 10000 });
    await expect(pre).toContainText("提示词内容");
  });

  test("prompt tab shows 暂无提示词 when no prompts exist", async ({ page }) => {
    // Mock the prompt list endpoint to return error (as if no prompts generated)
    await page.route("**/api/projects/**/chapters/*/prompts", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({ status: 404, body: "Not found" });
    });

    await page.getByText("提示词").click();
    const pre = page.locator("pre");
    await expect(pre).toBeVisible({ timeout: 10000 });
    await expect(pre).toContainText("暂无提示词");
  });

  // =========================================================================
  // Story 7.1: SSE 流式写作 (Phase 5)
  // =========================================================================

  test("AI 写本章 button is visible when chapter is selected in prose tab", async ({ page }) => {
    await expect(page.getByRole("button", { name: /AI.*写本章/ })).toBeVisible();
  });

  test("clicking AI 写本章 starts SSE streaming and fills prose on completion", async ({ page }) => {
    const fullText = "第一章的正文开始。\n\n继续生成更多内容。";
    await page.route("**/api/projects/**/chapters/*/write", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const ssePayload = [
        `data: {"type": "chunk", "text": "第一章的正文开始。"}`,
        `data: {"type": "chunk", "text": "\\n\\n继续生成更多内容。"}`,
        `data: {"type": "done", "full_text": "${fullText}", "tokens": {"input": 50, "output": 20}}`,
      ].join("\n\n") + "\n\n";
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: ssePayload,
      });
    });

    // Wait for the SSE write request to complete
    const writeResponse = page.waitForResponse(
      (r) => r.url().includes("/chapters/") && r.url().includes("/write") && r.status() === 200
    );
    await page.getByRole("button", { name: /AI.*写本章/ }).click();
    await writeResponse;

    // After SSE stream completes, the generated prose should populate the textarea
    const prose = page.locator("main").getByPlaceholder("正文（在此撰写小说内容）");
    await expect(prose).toHaveValue(/第一章的正文开始/, { timeout: 15000 });
  });

  // =========================================================================
  // Story 7.2: SSE 写作控制 — 停止按钮
  // =========================================================================

  test("stop button appears during streaming and exits writing state on click", async ({ page }) => {
    // Delay the SSE response so streaming state is visible long enough
    await page.route("**/api/projects/**/chapters/*/write", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      // Hold the response for 3 seconds so the stop button is catchable
      await new Promise((r) => setTimeout(r, 3000));
      try {
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          headers: { "Cache-Control": "no-cache" },
          body: 'data: {"type": "done", "full_text": "", "tokens": {"input": 0, "output": 0}}\n\n',
        });
      } catch {
        // Request was aborted by stop button — expected
      }
    });

    await page.getByRole("button", { name: /AI.*写本章/ }).click();

    // During streaming, the stop button must be visible
    await expect(page.getByText("⏹ 停止")).toBeVisible({ timeout: 5000 });

    // Click stop to abort the stream
    await page.getByText("⏹ 停止").click();

    // After abort, the editor should return to the ready state with AI写本章 button
    await expect(page.getByRole("button", { name: /AI.*写本章/ })).toBeVisible({ timeout: 5000 });
  });

  // =========================================================================
  // Story 7.4-7.6: Editor features
  // =========================================================================

  test("quality check button is visible and shows results when clicked", async ({ page }) => {
    // Type prose first — the quality check button is disabled when prose is empty
    const prose = page.getByPlaceholder("正文（在此撰写小说内容）");
    await prose.fill("这是一段测试正文内容。");

    // Mock the quality check endpoint (reads from filesystem, mock for determinism)
    await page.route("**/api/projects/**/chapters/*/write/quality-check", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          passed: true,
          checks: {
            fatigue_words: { passed: true, hits: [] },
            structural_tic_patterns: { passed: true, hits: {}, over_threshold: {} },
            dialogue_ratio: { passed: true, value: 0.1 },
            description_ratio: { passed: true, value: 0.05 },
            hook_mentions: { passed: true, expected: 0, found: 0 },
            continuity: { passed: true, note: "skipped in v1" },
          },
        }),
      });
    });

    await page.getByText("质量检查").click();
    await expect(page.getByText("✅ 通过")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("fatigue words")).toBeVisible();
  });

  test("archive button is visible and enabled when prose is present", async ({ page }) => {
    const archiveBtn = page.getByRole("button", { name: "归档" });
    await expect(archiveBtn).toBeVisible();

    // Before prose is entered, the button is disabled
    await expect(archiveBtn).toBeDisabled();

    // Type some prose to enable it
    const prose = page.getByPlaceholder("正文（在此撰写小说内容）");
    await prose.fill("可归档的正文内容。");

    await expect(archiveBtn).toBeEnabled({ timeout: 5000 });
  });

  test("history button is visible in chapter editor", async ({ page }) => {
    await expect(page.getByText("历史版本")).toBeVisible();
  });

  test("word count display updates when prose is entered", async ({ page }) => {
    const prose = page.getByPlaceholder("正文（在此撰写小说内容）");
    await prose.fill("12345");

    // The word count display is a span with class tabular-nums
    await expect(page.locator("span.tabular-nums").first()).toContainText("5", { timeout: 5000 });
  });

  test("save button is available when content is modified", async ({ page }) => {
    const prose = page.getByPlaceholder("正文（在此撰写小说内容）");
    await prose.fill("edited content");

    // The save button is always rendered; a dirty badge or label indicates modification
    await expect(page.getByRole("button", { name: "保存" })).toBeVisible();
    await expect(page.getByRole("button", { name: "保存" })).toBeEnabled();
  });
});
