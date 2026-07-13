import { test, expect } from "@playwright/test";
import { url } from "./helpers";

// =========================================================================
// Landing page — all sections and interactive elements
// =========================================================================

test.describe("Landing page", () => {
  // ── Hero ──────────────────────────────────────────────────────────
  test.describe("Hero", () => {
    test("renders badge, headline, subtitle, and CTAs", async ({ page }) => {
      await page.goto(url("/"));
      await expect(page.getByText("AI 辅助长篇小说写作平台").first()).toBeVisible();
      await expect(page.locator("h1")).toContainText("AI 陪你走完每一步");
      await expect(
        page.getByText("从世界设定到卷章管理，从逐章写作到版本回溯")
      ).toBeVisible();
      await expect(page.getByText("AI 是笔，你才是作家")).toBeVisible();
      await expect(page.getByText("免费开始写作")).toBeVisible();
      await expect(page.getByText("查看完整工作流")).toBeVisible();
    });

    test("CTA links to register page", async ({ page }) => {
      await page.goto(url("/"));
      await page.getByText("免费开始写作").click();
      await expect(page).toHaveURL(/#\/register/);
    });

    test("查看完整工作流 scrolls to workflow section", async ({ page }) => {
      await page.goto(url("/"));
      await page.getByText("查看完整工作流").click();
      await expect(page.locator("#how")).toBeVisible();
    });
  });

  // ── Navigation bar ────────────────────────────────────────────────
  test.describe("Navigation bar", () => {
    test("nav links present and scroll to sections", async ({ page }) => {
      await page.goto(url("/"));
      const nav = page.locator("nav.sticky");
      await expect(nav.getByText("创作之痛")).toBeVisible();
      await expect(nav.getByText("工作流")).toBeVisible();
      await expect(nav.getByText("特色")).toBeVisible();

      await nav.getByText("创作之痛").click({ force: true });
      await expect(page.locator("#pain-points")).toBeVisible();
      await nav.getByText("特色").click({ force: true });
      await expect(page.locator("#features")).toBeVisible();
    });

    test("has login and register links", async ({ page }) => {
      await page.goto(url("/"));
      await page.waitForLoadState("networkidle");
      const nav = page.locator("nav.sticky");
      await expect(nav.locator('a[href*="login"]')).toBeVisible();
      await expect(nav.locator('a[href*="register"]')).toBeVisible();
    });

    test("has theme toggle with Lucide SVG", async ({ page }) => {
      await page.goto(url("/"));
      const toggle = page.locator("nav.sticky button[title*='主题']");
      await expect(toggle).toBeVisible();
      await expect(toggle.locator("svg")).toBeVisible();
      await expect(toggle).not.toContainText("☀️");
      await expect(toggle).not.toContainText("🌙");
    });
  });

  // ── Pain points section ───────────────────────────────────────────
  test.describe("Pain points section", () => {
    test("section heading renders", async ({ page }) => {
      await page.goto(url("/"));
      await expect(page.locator("#pain-points")).toBeVisible();
      await expect(
        page.getByText("写小说最大的障碍，不是写得不好")
      ).toBeVisible();
    });

    test("three pain point cards with titles", async ({ page }) => {
      await page.goto(url("/"));
      await expect(page.getByText("空白页恐惧")).toBeVisible();
      await expect(page.getByText("大纲混乱、人设崩塌")).toBeVisible();
      await expect(page.getByText("反复推翻重写")).toBeVisible();
    });
  });

  // ── Workflow section ──────────────────────────────────────────────
  test.describe("Workflow section", () => {
    test("section heading renders", async ({ page }) => {
      await page.goto(url("/"));
      await expect(page.locator("#how")).toBeVisible();
      await expect(
        page.getByText("小说结构驱动创作")
      ).toBeVisible();
    });

    test("three workflow step cards", async ({ page }) => {
      await page.goto(url("/"));
      // Use heading role to disambiguate from section description
      await expect(page.getByRole("heading", { name: "设定世界" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "分卷规划" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "逐章写作" })).toBeVisible();
    });
  });

  // ── Features section ──────────────────────────────────────────────
  test.describe("Features section", () => {
    test("section heading renders", async ({ page }) => {
      await page.goto(url("/"));
      await expect(page.locator("#features")).toBeVisible();
      await expect(
        page.getByText("不只是生成文字，而是帮你写出好故事")
      ).toBeVisible();
    });

    test("four feature cards with titles", async ({ page }) => {
      await page.goto(url("/"));
      await expect(page.getByText("上下文感知生成")).toBeVisible();
      await expect(page.getByText("六维质量检测")).toBeVisible();
      await expect(page.getByText("风格模板系统")).toBeVisible();
      await expect(page.getByText("用量透明可控")).toBeVisible();
    });
  });

  // ── CTA section ───────────────────────────────────────────────────
  test.describe("CTA section", () => {
    test("CTA heading and buttons", async ({ page }) => {
      await page.goto(url("/"));
      await expect(
        page.getByText("现在开始，写你的第一部小说")
      ).toBeVisible();
      // Two "免费开始" links exist (hero + CTA) — use last() for CTA section
      const ctaSection = page.locator("section").last();
      await expect(ctaSection.getByText("免费开始").first()).toBeVisible();
      await expect(page.getByText(/去 GitHub 点 Star/)).toBeVisible();
    });

    test("免费开始 links to register", async ({ page }) => {
      await page.goto(url("/"));
      // Click the last CTA button (bottom of page)
      await page.getByRole("link", { name: "免费开始 →" }).click();
      await expect(page).toHaveURL(/#\/register/);
    });
  });

  // ── Footer ────────────────────────────────────────────────────────
  test.describe("Footer", () => {
    test("copyright text visible", async ({ page }) => {
      await page.goto(url("/"));
      await expect(
        page.getByText("爱小说 · AI 辅助长篇小说写作平台")
      ).toBeVisible();
    });
  });

  // ── Theme toggle ──────────────────────────────────────────────────
  test.describe("Theme toggle on landing page", () => {
    test("defaults to novelforge (dark)", async ({ page }) => {
      await page.goto(url("/"));
      await expect(page.locator("html")).toHaveAttribute("data-theme", "novelforge");
    });

    test("toggles to parchment and persists", async ({ page }) => {
      await page.goto(url("/"));
      const toggle = page.locator("nav.sticky button[title*='主题']");
      await toggle.click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "parchment");

      const theme = await page.evaluate(() =>
        localStorage.getItem("ai-novel-theme")
      );
      expect(theme).toBe("parchment");
    });
  });
});
