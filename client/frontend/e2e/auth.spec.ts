import { test, expect } from "@playwright/test";
import { url } from "./helpers";

// =========================================================================
// Auth pages — login, register entry points, navbar, theme, redirects
// =========================================================================
// NOTE: LoginPage uses browser-based auth (OAuth-like single button),
// not a traditional email/password form. There is no `/register` route
// in the app yet; register tests cover the CTA entry points.

test.describe("Login page", () => {
  test("renders with heading and browser auth button", async ({ page }) => {
    await page.goto(url("/login"));
    await expect(page.getByRole("heading", { name: "AI Novel" })).toBeVisible();
    await expect(page.getByText("登录以授权此设备")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "打开浏览器登录" })
    ).toBeVisible();
    await expect(
      page.getByText("将在系统浏览器中打开登录页面")
    ).toBeVisible();
  });

  test("OAuth button triggers loading state on click", async ({ page }) => {
    // Delay the auth response so loading state is visible
    await page.route("**/auth/browser-auth", async (route) => {
      await new Promise(r => setTimeout(r, 2000));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: 0 }) });
    });

    await page.goto(url("/login"));
    const btn = page.getByRole("button", { name: "打开浏览器登录" });
    await expect(btn).toBeEnabled();
    // Click triggers POST /auth/browser-auth — button enters loading state
    await btn.click();
    // Loading spinner should be visible while request is pending
    await expect(page.locator(".loading-spinner")).toBeVisible({ timeout: 3000 });
  });

  test("error message not visible initially", async ({ page }) => {
    await page.goto(url("/login"));
    await expect(page.getByText(/登录失败/)).toHaveCount(0);
  });
});

test.describe("Register page", () => {
  test("landing page has register CTA buttons", async ({ page }) => {
    await page.goto(url("/"));
    await expect(
      page.getByRole("link", { name: "免费开始写作" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "开始使用" })
    ).toBeVisible();
  });

  test("register CTA navigates to /register route", async ({ page }) => {
    await page.goto(url("/"));
    await page.getByRole("link", { name: "免费开始写作" }).click();
    await expect(page).toHaveURL(/#\/register/);
  });

  test("navbar has register link when logged out", async ({ page }) => {
    await page.goto(url("/login"));
    const registerLink = page.getByRole("link", { name: "注册" });
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toHaveAttribute("href", /register/);
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

test.describe("Auth redirect", () => {
  test("no-token redirects from dashboard to login", async ({ page }) => {
    // Visiting a protected route without an auth token
    // AuthGuard detects missing token and redirects to /login
    await page.goto(url("/books"), { waitUntil: "commit" });
    // Wait for the redirect to complete
    await expect(page).toHaveURL(/#\/login/, { timeout: 10000 });
  });

  test("login page shows on direct navigation after redirect", async ({ page }) => {
    // After being redirected from a protected page,
    // the login page should render its content
    await page.goto(url("/books"), { waitUntil: "commit" });
    await expect(page).toHaveURL(/#\/login/, { timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: "AI Novel" })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: "打开浏览器登录" })
    ).toBeVisible();
  });
});
