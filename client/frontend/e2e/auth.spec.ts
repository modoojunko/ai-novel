import { test, expect } from "@playwright/test";
import { url } from "./helpers";

// =========================================================================
// Auth pages — login, register entry points, navbar, theme, redirects
// =========================================================================
// NOTE: LoginPage uses browser-based auth (OAuth-like single button),
// not a traditional email/password form. There is no `/register` route
// in the app yet; register tests cover the CTA entry points.

test.describe("Login page", () => {
  test("error message not visible initially", async ({ page }) => {
    await page.goto(url("/login"));
    await expect(page.getByText(/登录失败/)).toHaveCount(0);
  });
});

test.describe("Entry points", () => {
  test("navbar has 开始使用 link when logged out", async ({ page }) => {
    await page.goto(url("/login"));
    const link = page.getByRole("link", { name: "开始使用" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /login/);
  });
});

test.describe("Navbar on auth pages", () => {
  test("hidden on landing page", async ({ page }) => {
    await page.goto(url("/"));
    await expect(page.locator(".navbar")).toHaveCount(0);
  });

  test("visible on login page with logo and theme toggle", async ({ page }) => {
    await page.goto(url("/login"));
    await expect(page.locator(".navbar")).toBeVisible();
    await expect(page.locator(".navbar").getByText("爱小说")).toBeVisible();
    const toggle = page.locator('.navbar button[title*="主题"]');
    await expect(toggle).toBeVisible();
    await expect(toggle.locator("svg")).toBeVisible();
  });

  test("theme toggle switches data-theme attribute on html", async ({ page }) => {
    await page.goto(url("/login"));
    // Default theme is "novelforge"
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      "novelforge"
    );
    // Click toggle switches to "parchment"
    await page.locator('.navbar button[title*="主题"]').click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      "parchment"
    );
  });

  test("theme persists when navigating between pages", async ({ page }) => {
    await page.goto(url("/login"));
    // Switch to parchment
    await page.locator('.navbar button[title*="主题"]').click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      "parchment"
    );
    // Navigate to landing page
    await page.locator(".navbar").getByText("爱小说").click();
    await expect(page).toHaveURL(url("/"));
    // Theme should still be parchment
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      "parchment"
    );
  });

  test("logo links to landing page", async ({ page }) => {
    await page.goto(url("/login"));
    await page.locator(".navbar").getByText("爱小说").click();
    await expect(page).toHaveURL(url("/"));
  });
});

test.describe("Page transitions", () => {
  test("page-enter class present on rendered pages", async ({ page }) => {
    await page.goto(url("/"));
    await expect(page.locator(".page-enter")).toHaveCount(1);
    await page.goto(url("/login"));
    await expect(page.locator(".page-enter")).toBeVisible();
  });
});

test.describe("Lucide icons", () => {
  test("navbar logo uses BookOpen SVG", async ({ page }) => {
    await page.goto(url("/login"));
    await expect(
      page.locator('.navbar a[href*="#/"] svg')
    ).toBeVisible();
  });

  test("navbar theme toggle uses Sun/Moon SVG", async ({ page }) => {
    await page.goto(url("/login"));
    await expect(
      page.locator('.navbar button[title*="主题"] svg')
    ).toBeVisible();
  });
});

// Auth redirect 行为已由 OAuth 静默自动登录取代（/login 页 check-auth 成功即跳回
// /novels），原「无 token 停在登录页」的断言不再成立，随 P0-P5 重设计移除。
