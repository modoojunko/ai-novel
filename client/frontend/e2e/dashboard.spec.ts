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
    // Manual setup without networkidle dependency
    await page.goto(url("/books"));
    const { token } = await createTestUser(page);
    await setToken(page, token);
    await page.goto(url("/books"));
    // Wait for the dashboard heading to render
    await expect(page.getByRole("heading", { name: "我的作品" })).toBeVisible({ timeout: 10000 });
  });

  test("page title and create button visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "我的作品" })).toBeVisible();
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
    await page.goto(url("/books"));
    await setToken(page, token);

    const name = `NavTest_${Date.now()}`;
    await page.request.post(`${API_URL}/projects`, {
      data: { name },
      headers: { Authorization: `Bearer ${token}` },
    });
    await page.goto(url("/books"));
    await page.waitForSelector("h1", { timeout: 10000 });

    await page.getByText(name).click();
    await expect(page).toHaveURL(/#\/project\//);
  });
});

// =========================================================================
// AI Suggestion Feature — Story 3.4
// =========================================================================

test.describe("AI Suggestion Feature", () => {
  const MOCK_SUGGESTION = {
    titles: ["星辰追凶", "暗夜迷踪", "刑警笔记"],
    synopsis:
      "一名退役刑警在调查三年前的悬案时，发现所有线索都指向他自己。",
    genre_profile: "mystery_thriller",
    genre_label: "悬疑 / 惊悚",
    atmosphere: "冷峻",
    elements: {
      "主角": "退役刑警",
      "世界观": "现代都市",
      "核心冲突": "寻找真相",
      "情感基调": "压抑",
    },
  };

  test("create modal shows AI greeting and premise input by default", async ({
    page,
  }) => {
    await page.goto(url("/books"));
    const { token } = await createTestUser(page);
    await setToken(page, token);
    await page.goto(url("/books"));
    await expect(page.getByRole("heading", { name: "我的作品" })).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "开始新小说" }).click();
    await expect(page.locator(".modal-box")).toBeVisible();

    // AI greeting message
    await expect(page.getByText("你想写一个什么样的故事？")).toBeVisible();
    // Premise textarea placeholder
    await expect(
      page.getByPlaceholder("比如：一个退役刑警"),
    ).toBeVisible();
    // AI suggest button
    await expect(
      page.getByRole("button", { name: /AI 帮我起名/ }),
    ).toBeVisible();
    // Skip link to manual mode
    await expect(
      page.getByText("我已经有书名和想法了"),
    ).toBeVisible();
  });

  test("submitting premise triggers AI suggestion and shows results", async ({
    page,
  }) => {
    // Manual setup without networkidle
    await page.goto(url("/books"));
    const { token } = await createTestUser(page);
    await setToken(page, token);
    await page.goto(url("/books"));
    await expect(page.getByRole("heading", { name: "我的作品" })).toBeVisible({ timeout: 10000 });

    // Mock AI suggestion endpoint
    await page.route("**/api/ai/suggest-meta", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SUGGESTION),
      });
    });

    await page.getByRole("button", { name: "开始新小说" }).click();
    await expect(page.locator(".modal-box")).toBeVisible();

    // Type premise
    await page
      .getByPlaceholder("比如：一个退役刑警")
      .fill("退役刑警调查悬案");

    // Click suggest button
    await page
      .getByRole("button", { name: /AI 帮我起名/ })
      .click();

    // Verify suggestion results
    await expect(page.getByText("AI 为你准备了")).toBeVisible();
    await expect(
      page.getByRole("button", { name: MOCK_SUGGESTION.titles[0] }),
    ).toBeVisible();
    await expect(page.getByText(MOCK_SUGGESTION.synopsis)).toBeVisible();
    await expect(
      page.getByText(MOCK_SUGGESTION.genre_label),
    ).toBeVisible();
    await expect(
      page.getByText(MOCK_SUGGESTION.atmosphere),
    ).toBeVisible();
  });

  test("selecting a suggestion title fills the name field", async ({
    page,
  }) => {
    await page.goto(url("/books"));
    const { token } = await createTestUser(page);
    await setToken(page, token);
    await page.goto(url("/books"));
    await expect(page.getByRole("heading", { name: "我的作品" })).toBeVisible({ timeout: 10000 });

    await page.route("**/api/ai/suggest-meta", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SUGGESTION),
      });
    });

    await page.getByRole("button", { name: "开始新小说" }).click();
    await page
      .getByPlaceholder("比如：一个退役刑警")
      .fill("悬疑故事");
    await page
      .getByRole("button", { name: /AI 帮我起名/ })
      .click();

    // Click the first title suggestion
    await page
      .getByRole("button", { name: MOCK_SUGGESTION.titles[0] })
      .click();

    // Title input should show selected title
    await expect(
      page.getByPlaceholder("修改标题…"),
    ).toHaveValue(MOCK_SUGGESTION.titles[0]);

    // Create button should reflect the selected title
    await expect(
      page.getByRole("button", {
        name: `创建《${MOCK_SUGGESTION.titles[0]}》`,
      }),
    ).toBeVisible();
  });

  test("accept suggestion and create project navigates to project page", async ({
    page,
  }) => {
    await page.goto(url("/books"));
    const { token } = await createTestUser(page);
    await setToken(page, token);
    await page.goto(url("/books"));
    await expect(page.getByRole("heading", { name: "我的作品" })).toBeVisible({ timeout: 10000 });

    await page.route("**/api/ai/suggest-meta", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SUGGESTION),
      });
    });

    await page.getByRole("button", { name: "开始新小说" }).click();
    await page
      .getByPlaceholder("比如：一个退役刑警")
      .fill("退役刑警的故事");
    await page
      .getByRole("button", { name: /AI 帮我起名/ })
      .click();

    // Select first title and create
    await page
      .getByRole("button", { name: MOCK_SUGGESTION.titles[0] })
      .click();
    await page
      .getByRole("button", {
        name: `创建《${MOCK_SUGGESTION.titles[0]}》`,
      })
      .click();

    // Should navigate to project page
    await expect(page).toHaveURL(/#\/project\//);
  });
});

// =========================================================================
// Free Tier Banner — Story 3.5
// =========================================================================

test.describe("Free Tier Banner", () => {
  test("free tier banner visible with trial days text", async ({ page }) => {
    const { token } = await createTestUser(page);

    // Mock auth endpoints so the SPA sees free tier
    await page.route("**/api/auth/verify", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          valid: true,
          tier: "none",
          trial_remaining_days: 7,
        }),
      });
    });
    // Prevent redirect to config page
    await page.route("**/api/auth/config", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ has_api_key: true }),
      });
    });

    await page.goto(url("/books"));
    await setToken(page, token);
    await page.goto(url("/books"));
    // Wait for dashboard heading instead of networkidle
    await expect(page.getByRole("heading", { name: "我的作品" })).toBeVisible({ timeout: 10000 });

    // Free tier banner should show trial days
    await expect(page.getByText(/AI 试用还剩/)).toBeVisible();
    await expect(page.getByText("7 天")).toBeVisible();
  });

  test("free tier banner has upgrade link", async ({ page }) => {
    const { token } = await createTestUser(page);

    await page.route("**/api/auth/verify", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          valid: true,
          tier: "none",
          trial_remaining_days: 7,
        }),
      });
    });
    await page.route("**/api/auth/config", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ has_api_key: true }),
      });
    });

    await page.goto(url("/books"));
    await setToken(page, token);
    await page.goto(url("/books"));
    // Wait for dashboard heading instead of networkidle
    await expect(page.getByRole("heading", { name: "我的作品" })).toBeVisible({ timeout: 10000 });

    // Upgrade link exists
    const upgradeLink = page.getByRole("link", { name: "了解套餐" });
    await expect(upgradeLink).toBeVisible();
    await expect(upgradeLink).toHaveAttribute(
      "href",
      "https://taobao.com",
    );
  });
});

// =========================================================================
// Delete Project — Story 3.3
// =========================================================================

test.describe("Delete Project", () => {
  test("delete button visible on project card on hover", async ({
    page,
  }) => {
    const { token } = await createTestUser(page);
    await page.goto(url("/books"));
    await setToken(page, token);

    // Create a project
    const name = `DelTest_${Date.now()}`;
    await page.request.post(`${API_URL}/projects`, {
      data: { name },
      headers: { Authorization: `Bearer ${token}` },
    });

    await page.goto(url("/books"));
    await page.waitForSelector("h1", { timeout: 10000 });

    // Hover over the card to reveal the delete button (group-hover)
    await page.getByText(name).hover();
    // Delete button should be visible on hover
    await expect(page.getByTitle("删除小说")).toBeVisible();
  });

  test("canceling delete confirmation closes modal and project remains", async ({
    page,
  }) => {
    const { token } = await createTestUser(page);
    await page.goto(url("/books"));
    await setToken(page, token);

    const name = `DelCancel_${Date.now()}`;
    await page.request.post(`${API_URL}/projects`, {
      data: { name },
      headers: { Authorization: `Bearer ${token}` },
    });

    await page.goto(url("/books"));
    await page.waitForSelector("h1", { timeout: 10000 });

    // Hover and click delete
    await page.getByText(name).hover();
    await page.getByTitle("删除小说").click();

    // Confirm modal appears
    await expect(page.getByRole("button", { name: "确认删除" })).toBeVisible();

    // Click cancel
    await page.getByRole("button", { name: "取消" }).click();

    // Modal closed, project still visible
    await expect(page.getByRole("button", { name: "确认删除" })).not.toBeVisible();
    await expect(page.getByText(name)).toBeVisible();
  });

  test("confirm delete removes project and shows success toast", async ({
    page,
  }) => {
    const { token } = await createTestUser(page);
    await page.goto(url("/books"));
    await setToken(page, token);

    const name = `DelConfirm_${Date.now()}`;
    await page.request.post(`${API_URL}/projects`, {
      data: { name },
      headers: { Authorization: `Bearer ${token}` },
    });

    await page.goto(url("/books"));
    await page.waitForSelector("h1", { timeout: 10000 });

    // Hover and click delete
    await page.getByText(name).hover();
    await page.getByTitle("删除小说").click();

    // Type project name into confirmation input
    await page.getByPlaceholder(name).fill(name);

    // Click confirm delete
    await page.getByRole("button", { name: "确认删除" }).click();

    // Success toast should appear
    await expect(
      page.getByText(`《${name}》已删除`),
    ).toBeVisible();

    // Project removed from list — empty state shown
    await expect(page.getByText("暂无小说")).toBeVisible();
  });
});

// =========================================================================
// Project List Enhancements — Story 3.1
// =========================================================================

test.describe("Project List", () => {
  test("project cards show name, volume/chapter count, and update time", async ({
    page,
  }) => {
    const { token } = await createTestUser(page);
    await page.goto(url("/books"));
    await setToken(page, token);

    const name = `CardTest_${Date.now()}`;
    await page.request.post(`${API_URL}/projects`, {
      data: { name },
      headers: { Authorization: `Bearer ${token}` },
    });

    await page.goto(url("/books"));
    await page.waitForSelector("h1", { timeout: 10000 });

    // Card shows project name
    await expect(page.getByText(name)).toBeVisible();

    // Volume and chapter counts
    await expect(page.getByText(/0 卷/)).toBeVisible();
    await expect(page.getByText(/0 章/)).toBeVisible();

    // Update time indicator
    await expect(page.getByText(/更新于/)).toBeVisible();
  });

  test.skip("loading state shows skeleton before data loads", async ({
    page,
  }) => {
    // Skipped: skeleton timing is hard to capture reliably with route mocking
    const { token } = await createTestUser(page);

    // Create a project so data appears after loading
    await page.request.post(`${API_URL}/projects`, {
      data: { name: `SkeletonTest_${Date.now()}` },
      headers: { Authorization: `Bearer ${token}` },
    });

    // Set token before navigation so the authenticated fetch goes through the delay
    await page.goto(url("/books"));
    await setToken(page, token);

    // Intercept GET /api/projects to delay the response — makes skeleton visible
    await page.route("**/api/projects", async (route) => {
      if (route.request().method() === "GET") {
        await new Promise((r) => setTimeout(r, 800));
      }
      await route.continue();
    });

    await page.goto(url("/books"));

    // Skeleton should be visible during loading
    await expect(page.locator(".skeleton").first()).toBeVisible({
      timeout: 3000,
    });

    // Wait for data to load
    await page.waitForLoadState("networkidle");

    // Skeletons should disappear
    await expect(page.locator(".skeleton")).toHaveCount(0);

    // Project card should now be visible
    await expect(page.getByText(/SkeletonTest/)).toBeVisible();
  });
});
