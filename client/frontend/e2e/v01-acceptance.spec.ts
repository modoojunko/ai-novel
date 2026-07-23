import { test, expect } from '@playwright/test';

test.describe('v0.1 Acceptance Tests', () => {
  test('C端 Login page renders', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/#/login');
    await expect(page.locator('text=打开浏览器登录')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=AI Novel')).toBeVisible();
  });

  test('C端 Login button state', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/#/login');
    const btn = page.locator('button:has-text("打开浏览器登录")');
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test('C端 Home page renders', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/');
    // 应该显示 landing page 或 login page
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('S端 Login page renders', async ({ page }) => {
    await page.goto('http://127.0.0.1:19000/login');
    await expect(page.getByText('登录你的账号')).toBeVisible({ timeout: 10000 });
  });

  test('S端 Register page renders', async ({ page }) => {
    await page.goto('http://127.0.0.1:19000/register');
    await expect(page.locator('text=创建账号')).toBeVisible({ timeout: 10000 });
  });

  test('S端 Full register flow', async ({ page }) => {
    await page.goto('http://127.0.0.1:19000/register');
    await page.fill('input[id="username"]', `e2e_${Date.now()}`);
    await page.fill('input[id="password"]', 'test123');
    await page.fill('input[id="confirmPwd"]', 'test123');
    await page.fill('input[id="question"]', 'my pet?');
    await page.fill('input[id="answer"]', 'dog');
    await page.click('button:has-text("创建账号")');
    // 应该跳转到 dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('S端 Dashboard has sections', async ({ page }) => {
    await page.goto('http://127.0.0.1:19000/register');
    await page.fill('input[id="username"]', `e2e_${Date.now()}`);
    await page.fill('input[id="password"]', 'test123');
    await page.fill('input[id="confirmPwd"]', 'test123');
    await page.fill('input[id="question"]', 'q');
    await page.fill('input[id="answer"]', 'a');
    await page.click('button:has-text("创建账号")');
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    // 验证导航存在
    await expect(page.getByRole('link', { name: /我的套餐/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /激活新码/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /我的设备/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /账号信息/ })).toBeVisible();
    await expect(page.getByText('暂无激活记录')).toBeVisible();
  });
});
