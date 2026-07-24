import { test, expect } from "@playwright/test";
import { url } from "./helpers";

// =========================================================================
// Helpers
// =========================================================================

async function mockNoConfig(page: any) {
  await page.route("**/api/auth/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ has_api_key: false, api_base_url: "", api_model: "" }),
    });
  });
}

async function mockAlreadyConfigured(page: any) {
  await page.route("**/api/auth/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        has_api_key: true,
        api_base_url: "https://api.deepseek.com/anthropic",
        api_model: "deepseek-v4-flash",
      }),
    });
  });
}

async function gotoConfigPage(page: any) {
  await mockNoConfig(page);
  await page.goto(url("/config"));
  await expect(page.getByRole("heading", { name: "AI 模型配置" })).toBeVisible();
}

async function selectProvider(page: any, label: string) {
  await gotoConfigPage(page);
  await page.getByText(label).first().click();
  await expect(page.getByText(/^已选:/)).toBeVisible();
}

// =========================================================================
// API Key Configuration
// =========================================================================

test.describe("API Key Configuration", () => {
  // ── Provider Selection (Story 2.1) ───────────────────────────────────
  test.describe("Provider Selection (Story 2.1)", () => {
    test("renders heading and provider cards when no API key configured", async ({ page }) => {
      await gotoConfigPage(page);

      // Page heading
      await expect(page.getByRole("heading", { name: "AI 模型配置" })).toBeVisible();

      // All 3 provider cards rendered
      await expect(page.getByText("DeepSeek（推荐）")).toBeVisible();
      await expect(page.getByRole("heading", { name: "OpenAI" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Anthropic (Claude)" })).toBeVisible();

      // No loading spinner remains
      await expect(page.locator(".loading")).toHaveCount(0);
    });

    test("provider cards show description and tag badge", async ({ page }) => {
      await gotoConfigPage(page);

      // Descriptions
      await expect(page.getByText("价格便宜，中文效果好，新用户送 500 万 Token")).toBeVisible();
      await expect(page.getByText("全球最强模型，中文支持好")).toBeVisible();
      await expect(page.getByText("写作质量最高，适合专业作家")).toBeVisible();

      // Tag badges
      await expect(page.getByText("性价比之选")).toBeVisible();
      await expect(page.getByText("通用之选")).toBeVisible();
      await expect(page.getByText("专业之选")).toBeVisible();
    });

    test("clicking provider card advances to config step", async ({ page }) => {
      await gotoConfigPage(page);

      await page.getByText("DeepSeek（推荐）").click();

      // Config step shows provider badge
      await expect(page.getByText("已选: DeepSeek（推荐）")).toBeVisible();

      // API Key input is now visible
      await expect(page.getByPlaceholder("sk-...")).toBeVisible();

      // Provider selection should no longer be visible
      await expect(page.getByText("跳过配置，稍后再说")).not.toBeVisible();
    });

    test("each provider card has a registration link", async ({ page }) => {
      await gotoConfigPage(page);

      // Each link has text matching the provider name
      await expect(page.getByRole("link", { name: /去 DeepSeek 注册/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /去 OpenAI 注册/ })).toBeVisible();
      // Anthropic uses "Anthropic (Claude)" as label -> link text is "去 Anthropic (Claude) 注册 →"
      await expect(page.getByRole("link", { name: /去 Anthropic.*注册/ })).toBeVisible();

      // Links open in new tab (no navigation in test window)
      await expect(page.getByRole("link", { name: /去 DeepSeek 注册/ })).toHaveAttribute("target", "_blank");
      await expect(page.getByRole("link", { name: /去 DeepSeek 注册/ })).toHaveAttribute("rel", "noopener noreferrer");
    });

    test("selecting different providers shows correct base URL and model", async ({ page }) => {
      await gotoConfigPage(page);

      // DeepSeek
      await page.getByText("DeepSeek（推荐）").click();
      await expect(page.locator("[value='https://api.deepseek.com/anthropic']")).toBeVisible();
      await expect(page.locator("[value='deepseek-v4-flash']")).toBeVisible();
      // Go back
      await page.getByRole("button", { name: "返回" }).click();
      await expect(page.getByText("跳过配置，稍后再说")).toBeVisible({ timeout: 5000 });

      // OpenAI
      await page.getByRole("heading", { name: "OpenAI" }).click();
      await expect(page.locator("[value='https://api.openai.com/v1']")).toBeVisible();
      await expect(page.locator("[value='gpt-4o']")).toBeVisible();
      // Go back
      await page.getByRole("button", { name: "返回" }).click();
      await expect(page.getByText("跳过配置，稍后再说")).toBeVisible({ timeout: 5000 });

      // Anthropic
      await page.getByRole("heading", { name: "Anthropic (Claude)" }).click();
      await expect(page.locator("[value='https://api.anthropic.com/v1']")).toBeVisible();
      await expect(page.locator("[value='claude-sonnet-4-20250514']")).toBeVisible();
    });

    test("selecting provider clears any previously entered key", async ({ page }) => {
      await gotoConfigPage(page);

      // Select DeepSeek, type a key
      await page.getByText("DeepSeek（推荐）").click();
      await page.getByPlaceholder("sk-...").fill("sk-old-key");
      await expect(page.getByPlaceholder("sk-...")).toHaveValue("sk-old-key");

      // Go back and select another provider
      await page.getByRole("button", { name: "返回" }).click();
      await expect(page.getByText("跳过配置，稍后再说")).toBeVisible({ timeout: 5000 });
      await page.getByRole("heading", { name: "OpenAI" }).click();

      // API Key input should be empty
      await expect(page.getByPlaceholder("sk-...")).toHaveValue("");
    });
  });

  // ── API Key Input (Story 2.2) ────────────────────────────────────────
  test.describe("API Key Input (Story 2.2)", () => {
    test("API Key input is a password field", async ({ page }) => {
      await selectProvider(page, "DeepSeek（推荐）");

      await expect(page.getByPlaceholder("sk-...")).toHaveAttribute("type", "password");
    });

    test("API Key input accepts text", async ({ page }) => {
      await selectProvider(page, "DeepSeek（推荐）");

      await page.getByPlaceholder("sk-...").fill("sk-test-key-12345");
      await expect(page.getByPlaceholder("sk-...")).toHaveValue("sk-test-key-12345");
    });

    test("verify without key shows error toast", async ({ page }) => {
      await selectProvider(page, "DeepSeek（推荐）");

      // API Key is empty by default — click verify
      await page.getByRole("button", { name: "验证并保存" }).click();

      // Client-side validation error
      await expect(page.getByText("请输入 API Key")).toBeVisible();
    });

    test("skip button is visible on provider selection", async ({ page }) => {
      await gotoConfigPage(page);

      await expect(page.getByText("跳过配置，稍后再说")).toBeVisible();
    });

    test("API 地址 field shows provider base URL and is disabled", async ({ page }) => {
      await selectProvider(page, "DeepSeek（推荐）");

      const baseUrlInput = page.locator("[value='https://api.deepseek.com/anthropic']");
      await expect(baseUrlInput).toBeVisible();
      await expect(baseUrlInput).toBeDisabled();
    });
  });

  // ── Model Selection (Story 2.3) ──────────────────────────────────────
  test.describe("Model Selection (Story 2.3)", () => {
    test("model field is visible after selecting a provider", async ({ page }) => {
      await selectProvider(page, "DeepSeek（推荐）");

      await expect(page.getByText("模型", { exact: true })).toBeVisible();
    });

    test("default model matches provider's defaultModel", async ({ page }) => {
      await gotoConfigPage(page);

      // DeepSeek
      await page.getByText("DeepSeek（推荐）").click();
      await expect(page.locator("[value='deepseek-v4-flash']")).toBeVisible();

      // Go back and check OpenAI
      await page.getByRole("button", { name: "返回" }).click();
      await expect(page.getByText("跳过配置，稍后再说")).toBeVisible({ timeout: 5000 });
      await page.getByRole("heading", { name: "OpenAI" }).click();
      await expect(page.locator("[value='gpt-4o']")).toBeVisible();

      // Go back and check Anthropic
      await page.getByRole("button", { name: "返回" }).click();
      await expect(page.getByText("跳过配置，稍后再说")).toBeVisible({ timeout: 5000 });
      await page.getByRole("heading", { name: "Anthropic (Claude)" }).click();
      await expect(page.locator("[value='claude-sonnet-4-20250514']")).toBeVisible();
    });

    test("model field is disabled", async ({ page }) => {
      await selectProvider(page, "DeepSeek（推荐）");

      await expect(page.locator("[value='deepseek-v4-flash']")).toBeDisabled();
    });
  });

  // ── Navigation & State ──────────────────────────────────────────────
  test.describe("Navigation & State", () => {
    test("page has title heading and description", async ({ page }) => {
      await gotoConfigPage(page);

      await expect(page.getByRole("heading", { name: "AI 模型配置" })).toBeVisible();
      await expect(
        page.getByText("AI Novel 需要连接一个 AI 模型来辅助写作")
      ).toBeVisible();
    });

    test("back button returns to provider selection from config step", async ({ page }) => {
      await selectProvider(page, "DeepSeek（推荐）");

      // Click back
      await page.getByRole("button", { name: "返回" }).click();

      // Back to provider selection
      await expect(page.getByText("DeepSeek（推荐）")).toBeVisible();
      await expect(page.getByText("跳过配置，稍后再说")).toBeVisible();

      // Config step elements are gone
      await expect(page.getByText(/^已选:/)).not.toBeVisible();
    });

    test("page detects already-configured state from backend", async ({ page }) => {
      // Mock config to return pre-existing configuration
      await mockAlreadyConfigured(page);

      await page.goto(url("/config"));

      // Should skip provider selection and show config step directly
      await expect(page.getByText("已选: DeepSeek（推荐）")).toBeVisible({ timeout: 10000 });

      // Provider selection should NOT be shown
      await expect(page.getByText("跳过配置，稍后再说")).not.toBeVisible();

      // Pre-filled values
      await expect(page.locator("[value='https://api.deepseek.com/anthropic']")).toBeVisible();
      await expect(page.locator("[value='deepseek-v4-flash']")).toBeVisible();
    });

    test("page shows loading spinner while fetching config", async ({ page }) => {
      // Delay the config response to test loading state
      let resolveConfig: (value: unknown) => void;
      const configPromise = new Promise((resolve) => { resolveConfig = resolve; });

      await page.route("**/api/auth/config", async (route) => {
        await configPromise;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ has_api_key: false, api_base_url: "", api_model: "" }),
        });
      });

      // Start navigation but don't wait — the config request is deferred
      const navPromise = page.goto(url("/config"));

      // Loading spinner should appear
      await expect(page.locator(".loading")).toBeVisible();

      // Let config load
      resolveConfig!(undefined);
      await navPromise;

      // Spinner should be gone, heading should appear
      await expect(page.locator(".loading")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "AI 模型配置" })).toBeVisible();
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────
  test.describe("Edge cases", () => {
    test("verification button shows loading state during API call", async ({ page }) => {
      await selectProvider(page, "DeepSeek（推荐）");
      await page.getByPlaceholder("sk-...").fill("sk-test-key-123");

      // Defer the verify-key response
      let resolveVerify: (value: unknown) => void;
      const verifyPromise = new Promise((resolve) => { resolveVerify = resolve; });

      await page.route("**/api/auth/verify-key", async (route) => {
        await verifyPromise;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ valid: true }),
        });
      });

      // Click verify
      await page.getByRole("button", { name: "验证并保存" }).click();

      // Button should be disabled and show spinner
      const verifyBtn = page.locator("button.btn-primary");
      await expect(verifyBtn).toBeDisabled();
      await expect(verifyBtn.locator(".loading")).toBeVisible();

      // Let the request complete
      resolveVerify!(undefined);
    });

    test("API Key validation error shows error toast", async ({ page }) => {
      await selectProvider(page, "DeepSeek（推荐）");
      await page.getByPlaceholder("sk-...").fill("sk-invalid-key");

      await page.route("**/api/auth/verify-key", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ valid: false, error: "API Key 无效" }),
        });
      });

      await page.getByRole("button", { name: "验证并保存" }).click();

      // Error toast should show the error message from the API
      await expect(page.getByText("API Key 无效")).toBeVisible();
    });

    test("verify-and-save success flow shows success toast and calls save API", async ({ page }) => {
      await selectProvider(page, "DeepSeek（推荐）");
      await page.getByPlaceholder("sk-...").fill("sk-valid-key");

      let verifyCalled = false;
      let saveCalled = false;

      // Intercept verify-key — return valid
      await page.route("**/api/auth/verify-key", async (route) => {
        verifyCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ valid: true }),
        });
      });

      // Intercept save API
      await page.route("**/api/auth/config/api-key", async (route) => {
        saveCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ code: 0, msg: "保存成功" }),
        });
      });

      await page.getByRole("button", { name: "验证并保存" }).click();

      // Success toast appears
      await expect(page.getByText("配置成功！")).toBeVisible();

      // Verify that the APIs were called (the toast confirms both succeeded)
      expect(verifyCalled).toBe(true);
      expect(saveCalled).toBe(true);
    });

    test("fallback error message when API returns no error text", async ({ page }) => {
      await selectProvider(page, "DeepSeek（推荐）");
      await page.getByPlaceholder("sk-...").fill("sk-invalid-key");

      // Mock verify-key to return valid=false WITHOUT error field
      await page.route("**/api/auth/verify-key", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ valid: false }),
        });
      });

      await page.getByRole("button", { name: "验证并保存" }).click();

      // Fallback error message
      await expect(page.getByText("Key 验证失败，请检查后重试")).toBeVisible();
    });

    test("network error during verification shows network error toast", async ({ page }) => {
      await selectProvider(page, "DeepSeek（推荐）");
      await page.getByPlaceholder("sk-...").fill("sk-test-key");

      // Mock verify-key to return an error status
      await page.route("**/api/auth/verify-key", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Internal Server Error" }),
        });
      });

      await page.getByRole("button", { name: "验证并保存" }).click();

      // Network error message
      await expect(page.getByText("验证请求失败，请检查网络")).toBeVisible();
    });
  });
});
