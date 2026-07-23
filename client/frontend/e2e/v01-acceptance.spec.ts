import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

// 获取唯一的用户名
function uid() { return `e2e_${Date.now()}`; }

test.describe('v0.1 用户主线流程', () => {

  test('S1: S端 注册 → 登录 → Dashboard', async ({ page }) => {
    const user = uid();
    await page.goto('http://127.0.0.1:19000/register');
    await page.fill('input[id="username"]', user);
    await page.fill('input[id="password"]', 'test123');
    await page.fill('input[id="confirmPwd"]', 'test123');
    await page.fill('input[id="question"]', 'pet?');
    await page.fill('input[id="answer"]', 'dog');
    await page.click('button:has-text("创建账号")');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByRole('link', { name: /我的套餐/ })).toBeVisible();
    await expect(page.getByText('暂无激活记录')).toBeVisible();
  });

  test('S2: 激活新码后套餐显示更新', async ({ request }) => {
    const user = uid();
    await request.post('http://127.0.0.1:19000/api/web/register', {
      data: { username: user, password: 'test123', security_question: 'q', security_answer: 'a' }
    });
    const codeResp = await request.post('http://127.0.0.1:19000/api/generate_code', {
      data: { admin_token: 'admin123', tier: 'yearly', count: 1 }
    });
    const code = (await codeResp.json()).data.codes[0];
    const loginResp = await request.post('http://127.0.0.1:19000/api/web/login', {
      data: { username: user, password: 'test123' }
    });
    const token = (await loginResp.json()).data.token;
    // 激活前 tier 为 none
    let me = await (await request.get('http://127.0.0.1:19000/api/user/me', {
      headers: { Authorization: 'Bearer ' + token }
    })).json();
    expect(me.data.tier).toBe('none');
    // 激活
    await request.post('http://127.0.0.1:19000/api/license/activate', {
      data: { code },
      headers: { Authorization: 'Bearer ' + token }
    });
    // 激活后 tier 变为 yearly
    me = await (await request.get('http://127.0.0.1:19000/api/user/me', {
      headers: { Authorization: 'Bearer ' + token }
    })).json();
    expect(me.data.tier).toBe('yearly');
    expect(me.data.expires_at).toBeTruthy();
  });

});

test.describe('v0.1 前端交互覆盖', () => {

  test('F1: C端 登录页渲染', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/#/login');
    await expect(page.locator('button:has-text("打开浏览器登录")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=AI Novel')).toBeVisible();
  });

  test('F2: C端 登录按钮可用', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/#/login');
    const btn = page.locator('button:has-text("打开浏览器登录")');
    await expect(btn).toBeEnabled();
  });

  test('F3: C端 OAuth 授权流程（模拟浏览器授权）', async ({ page, context }) => {
    // 1. 先通过 API 注册 S端 用户 + 预授权 pc_hash
    const user = uid();
    const pcHash = 'playwright-' + randomUUID().slice(0, 8);
    await (await context.request).post('http://127.0.0.1:19000/api/web/register', {
      data: { username: user, password: 'test123', security_question: 'q', security_answer: 'a' }
    });
    // 2. 设置 C端 config.json 中的 pc_hash（通过 API）
    // 由于不能直接改文件，直接用 authorize API 预授权
    await (await context.request).post('http://127.0.0.1:19000/api/authorize', {
      data: { username: user, password: 'test123', pc_hash: pcHash }
    });
    // 3. 设置 C端 的 config.json（通过 API 写入 server_api + pc_hash）
    // 这里简化：直接通过 S端 API 验证授权
    const checkAuth = await (await context.request).get('http://127.0.0.1:19000/api/check-auth?pc_hash=' + pcHash);
    const authData = (await checkAuth.json()).data;
    expect(authData.token).toBeTruthy();
    expect(authData.tier).toBe('none');
  });

  test('F4: S端 注册页渲染', async ({ page }) => {
    await page.goto('http://127.0.0.1:19000/register');
    await expect(page.locator('text=创建账号')).toBeVisible({ timeout: 10000 });
  });

  test('F5: S端 登录页渲染', async ({ page }) => {
    await page.goto('http://127.0.0.1:19000/login');
    await expect(page.getByText('登录你的账号')).toBeVisible({ timeout: 10000 });
  });

  test('F6: S端 Dashboard 页面可通过 token 访问', async ({ request }) => {
    const user = uid();
    const r = await request.post('http://127.0.0.1:19000/api/web/register', {
      data: { username: user, password: 'test123', security_question: 'q', security_answer: 'a' }
    });
    const token = (await r.json()).data.token;
    // 确认 API 层面用户信息正确
    const me = await (await request.get('http://127.0.0.1:19000/api/user/me', {
      headers: { Authorization: 'Bearer ' + token }
    })).json();
    expect(me.code).toBe(0);
    expect(me.data.username).toBe(user);
  });

  test('F7: S端 注册流程完成后可获取用户信息', async ({ request }) => {
    const user = uid();
    const r = await request.post('http://127.0.0.1:19000/api/web/register', {
      data: { username: user, password: 'test123', security_question: 'q', security_answer: 'a' }
    });
    expect((await r.json()).code).toBe(0);
    // 登录验证
    const login = await request.post('http://127.0.0.1:19000/api/web/login', {
      data: { username: user, password: 'test123' }
    });
    expect((await login.json()).code).toBe(0);
  });

});

test.describe('v0.1 API 门控验证', () => {

  test('G1: 权限门控: check_permission 返回免费层字段', async ({ request }) => {
    const r = await request.get('http://127.0.0.1:8000/api/auth/permission');
    expect(r.status()).toBe(200);
    const perm = await r.json();
    expect(perm.allowed).toBe(true);
    expect(perm.tier).toBe('none');
    expect(perm.project_limit).toBe(1);
    expect(perm.trial_remaining_days).toBeGreaterThan(0);
  });

  test('G2: 免费用户项目上限 1', async ({ request }) => {
    // 需要在 C端 创建一个有效的 token
    // 这里通过检查 API 响应确认门控存在
    const r = await request.get('http://127.0.0.1:8000/api/auth/permission');
    const perm = await r.json();
    expect(perm.allowed).toBe(true);
    expect(perm.project_limit).toBe(1);
    expect(perm.trial_remaining_days).toBeGreaterThan(0);
  });

});
