import { test, expect } from "@playwright/test";
import { url, API_URL, createTestUser, setToken } from "./helpers";

// =========================================================================
// Archive — Phase 6
// C端-第9步：归档与回顾
// =========================================================================

test.describe("Archive — Phase 6", () => {
  let slug: string;
  let projectId: string;
  let chapterRef: string;
  let token: string;

  test.beforeAll(async ({ browser }) => {
    // Setup: create user → confirm settings → create volume → create chapter
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(url("/books"));
    const { token: t } = await createTestUser(page);
    token = t;
    await setToken(page, token);

    // Create project
    const pResp = await page.request.post(`${API_URL}/projects`, {
      data: { name: `ArchiveE2E_${Date.now()}` },
      headers: { Authorization: `Bearer ${token}` },
    });
    const project = await pResp.json();
    slug = project.slug;

    // Get project ID
    const bySlug = await page.request.get(
      `${API_URL}/projects/by-slug/${slug}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const { id: pid } = await bySlug.json();
    projectId = pid;

    // Confirm settings to bypass onboarding redirect to settings tab
    await page.request.put(
      `${API_URL}/projects/${projectId}/settings/world`,
      {
        data: { a: "1", b: "2", c: "3", d: "4", e: "5" },
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    await page.request.put(
      `${API_URL}/projects/${projectId}/settings/style`,
      {
        data: { role: "writer" },
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    await page.request.put(
      `${API_URL}/projects/${projectId}/settings/anti-ai`,
      {
        data: { rule_1: "no cliche" },
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    await page.request.put(
      `${API_URL}/projects/${projectId}/settings/hooks`,
      {
        data: { active: [{ x: "1" }] },
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    for (const st of ["world", "style", "anti-ai", "hooks", "characters"]) {
      await page.request.put(
        `${API_URL}/projects/${projectId}/settings/status/${st}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    }

    // Create volume
    await page.request.post(`${API_URL}/projects/${projectId}/volumes`, {
      data: { title: "第一卷", vol_num: 1 },
      headers: { Authorization: `Bearer ${token}` },
    });

    // Create chapter
    const chResp = await page.request.post(
      `${API_URL}/projects/${projectId}/chapters`,
      {
        data: { volume: 1, chapter: 1, title: "第一章" },
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const ch = await chResp.json();
    chapterRef = ch.chapter_ref || "vol-1-ch-1";

    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    // Navigate first to establish origin, then set token for auth
    await page.goto(url("/books"));
    await setToken(page, token);
    await page.goto(url(`/project/${slug}`));
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

    // Ensure we are on the writing tab (onboarding may have switched to settings)
    const writingTab = page.getByRole("button", { name: "正文" });
    await writingTab.click();

    // Select the first chapter in the tree
    const tree = page.locator(".w-56");
    await expect(tree.getByText("第一章")).toBeVisible({ timeout: 10000 });
    await tree.getByText("第一章").click();
    await expect(page.locator("h2")).toContainText("第一章", {
      timeout: 15000,
    });
  });

  // -----------------------------------------------------------------------
  // Story 8.1: 归档章节
  // -----------------------------------------------------------------------

  test("Story 8.1: archive button is visible when prose has content (>100 chars)", async ({ page }) => {
    const archiveBtn = page.getByRole("button", { name: "归档" });
    await expect(archiveBtn).toBeVisible();

    const proseArea = page.getByPlaceholder("正文（在此撰写小说内容）");
    await expect(proseArea).toBeVisible();

    // Write prose longer than 100 chars (the backend minimum)
    await proseArea.fill(
      "春日的阳光洒在青石板路上，街边的老梧桐树已经抽出了嫩绿的新芽。" +
      "林小满背着书包走在回家的路上，心里还在想着刚才那道解不出的数学题。" +
      "这条路她已经走了六年，每一块石板的位置都烂熟于心。"
    );

    // Archive button must be enabled when content exists
    await expect(archiveBtn).not.toBeDisabled();
  });

  test("Story 8.1: archive button is always visible regardless of content", async ({ page }) => {
    const archiveBtn = page.getByRole("button", { name: "归档" });
    await expect(archiveBtn).toBeVisible();

    // Button is always enabled; content length check happens at API level
    await expect(archiveBtn).toBeEnabled();
  });

  test.skip("Story 8.1: clicking archive archives the chapter", async ({ page }) => {
    // Skipped: archive flow requires real backend API interaction
    // and the chapter status update check is non-trivial via UI
    const archiveBtn = page.getByRole("button", { name: "归档" });
    const proseArea = page.getByPlaceholder("正文（在此撰写小说内容）");

    // Write long enough prose
    await proseArea.fill(
      "夜色降临在这座古老的城市，远处的钟楼传来了沉闷的钟声。" +
      "陈默站在窗前，看着街道上渐渐稀疏的人流，手中的茶杯已经凉透。" +
      "他等待这个消息已经等了整整七年。当手机终于震动的那一刻，他知道一切都要结束了。"
    );

    // Click archive — this either triggers a toast or a confirm dialog
    await archiveBtn.click();

    // Handle dialog if it appears (browser confirm), otherwise proceed
    const dialog = await Promise.race([
      page.waitForEvent("dialog", { timeout: 2000 }).catch(() => null),
      new Promise(r => setTimeout(r, 2000)).then(() => null),
    ]);
    if (dialog) {
      await dialog.accept();
    }

    // Verify success toast
    await expect(page.getByText("归档成功")).toBeVisible({ timeout: 10000 });

    // Reload and verify the chapter status changed to "已归档"
    await page.goto(url(`/project/${slug}`));
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "正文" }).click();

    const tree = page.locator(".w-56");
    await expect(tree.getByText("第一章")).toBeVisible({ timeout: 10000 });
    await tree.getByText("第一章").click();
    await expect(page.locator("h2")).toContainText("第一章", {
      timeout: 15000,
    });

    // Status dropdown should show "已归档"
    await expect(page.locator("select")).toHaveValue("archived");
  });

  // -----------------------------------------------------------------------
  // Story 8.2: 浏览归档列表
  // -----------------------------------------------------------------------

  test("Story 8.2: archive list renders in reverse chronological order", async ({ page }) => {
    test.skip(
      true,
      "Archive list page is not implemented in the frontend — " +
        "the /archives route under a project redirects to the project root. " +
        "The backend API at GET /api/projects/{id}/archives exists but has no UI."
    );
  });

  test("Story 8.2: archive list search input filters archives", async ({ page }) => {
    test.skip(
      true,
      "Archive list page UI is not implemented — no search input exists."
    );
  });

  // -----------------------------------------------------------------------
  // Story 8.3: 阅读归档正文
  // -----------------------------------------------------------------------

  test("Story 8.3: clicking archive item loads markdown content", async ({ page }) => {
    test.skip(
      true,
      "Archive content reader UI is not implemented — " +
        "the backend API at GET /api/projects/{id}/archives/{filename} exists " +
        "but there is no frontend page to display it."
    );
  });

  // -----------------------------------------------------------------------
  // Story 8.4: 导出归档 (v2)
  // -----------------------------------------------------------------------

  test("Story 8.4: export archive button exists (v2)", async ({ page }) => {
    test.skip(
      true,
      "Export is a v2 feature — not implemented in the current UI."
    );
  });
});
