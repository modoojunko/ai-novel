import { test, expect } from "@playwright/test";
import { url } from "./helpers";

// =========================================================================
// Auth pages — login, register, navbar, theme
// =========================================================================

test.describe("Login page", () => {
  test("form renders with all fields and submit button", async ({ page }) => {
    await page.goto(url("/login"));
    await expect(page.getByPlaceholder("邮箱")).toBeVisible();
    await expect(page.getByPlaceholder("密码")).toBeVisible();
    await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
  });

  test("form fields accept input", async ({ page }) => {
    await page.goto(url("/login"));
    const emailInput = page.getByPlaceholder("邮箱");
    const passwordInput = page.getByPlaceholder("密码");

    await emailInput.fill("user@example.com");
    await passwordInput.fill("mypassword");

    await expect(emailInput).toHaveValue("user@example.com");
    await expect(passwordInput).toHaveValue("mypassword");
  });

  test("links to register page", async ({ page }) => {
    await page.goto(url("/login"));
    await page.locator(".card-body").getByText("注册").click();
    await expect(page).toHaveURL(/#\/register/);
  });

  test("requires email and password (form validation)", async ({ page }) => {
    await page.goto(url("/login"));
    const emailInput = page.getByPlaceholder("邮箱");
    const passwordInput = page.getByPlaceholder("密码");
    // HTML5 validation: email type + required
    await expect(emailInput).toHaveAttribute("required", "");
    await expect(passwordInput).toHaveAttribute("required", "");
    await expect(passwordInput).toHaveAttribute("minlength");
  });
});

test.describe("Register page", () => {
  test("form renders with all fields and submit button", async ({ page }) => {
    await page.goto(url("/register"));
    await expect(page.getByPlaceholder("昵称")).toBeVisible();
    await expect(page.getByPlaceholder("邮箱")).toBeVisible();
    await expect(page.getByPlaceholder(/密码/)).toBeVisible();
    await expect(page.getByRole("button", { name: "创建账号" })).toBeVisible();
  });

  test("form fields accept input", async ({ page }) => {
    await page.goto(url("/register"));
    await page.getByPlaceholder("昵称").fill("新作家");
    await page.getByPlaceholder("邮箱").fill("writer@test.com");
    await page.getByPlaceholder(/密码/).fill("SecurePass1!");

    await expect(page.getByPlaceholder("昵称")).toHaveValue("新作家");
    await expect(page.getByPlaceholder("邮箱")).toHaveValue("writer@test.com");
    await expect(page.getByPlaceholder(/密码/)).toHaveValue("SecurePass1!");
  });

  test("links back to login", async ({ page }) => {
    await page.goto(url("/register"));
    await page.locator(".card-body").getByText("登录").click();
    await expect(page).toHaveURL(/#\/login/);
  });

  test("password has minimum length requirement", async ({ page }) => {
    await page.goto(url("/register"));
    const pw = page.getByPlaceholder(/密码/);
    await expect(pw).toHaveAttribute("minlength");
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

  test("theme toggle works on login page", async ({ page }) => {
    await page.goto(url("/login"));
    await page.locator('.navbar button[title*="主题"]').click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "parchment");
  });

  test("theme persists navigating from login to register", async ({ page }) => {
    await page.goto(url("/login"));
    // Switch to parchment
    await page.locator('.navbar button[title*="主题"]').click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "parchment");
    // Navigate to register
    await page.locator(".card-body").getByText("注册").click();
    await expect(page).toHaveURL(/#\/register/);
    // Theme should still be parchment
    await expect(page.locator("html")).toHaveAttribute("data-theme", "parchment");
  });

  test("logo links to landing page", async ({ page }) => {
    await page.goto(url("/login"));
    await page.locator(".navbar").getByText("爱小说").click();
    await expect(page).toHaveURL(url("/"));
  });
});

test.describe("Page transitions", () => {
  test("page-enter class present on all pages", async ({ page }) => {
    await page.goto(url("/"));
    await expect(page.locator(".page-enter")).toHaveCount(1);
    await page.goto(url("/login"));
    await expect(page.locator(".page-enter")).toBeVisible();
    await page.goto(url("/register"));
    await expect(page.locator(".page-enter")).toBeVisible();
  });
});

test.describe("Lucide icons", () => {
  test("navbar logo uses BookOpen SVG", async ({ page }) => {
    await page.goto(url("/login"));
    await expect(page.locator('.navbar a[href*="#/"] svg')).toBeVisible();
  });

  test("navbar theme toggle uses Sun/Moon SVG", async ({ page }) => {
    await page.goto(url("/login"));
    await expect(
      page.locator('.navbar button[title*="主题"] svg')
    ).toBeVisible();
  });
});
