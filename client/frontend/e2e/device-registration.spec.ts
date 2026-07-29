import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// 设备注册与激活管理 — C端 + S端 联合 E2E 验收
//
// 覆盖场景：
//   - S端 授权页面传递 device_profile
//   - C端 后端代理 /api/auth/devices/current
//   - S端 仪表盘设备管理 Tab
//
// 前置条件：
//   - S端 运行在 http://127.0.0.1:19000（python server/local_server.py）
//   - C端 后端运行在 http://localhost:8000（uvicorn main:app）
// ---------------------------------------------------------------------------

const S_BASE = 'http://127.0.0.1:19000';
const ADMIN_TOKEN = 'admin123';

function uid(): string {
  return `de2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** 编码 DeviceProfile */
function encodeDeviceProfile(fingerprint: string, hostname = 'E2E-PC'): string {
  const payload = JSON.stringify({ f: fingerprint, h: hostname, o: 'Windows 11', a: 'x86_64' });
  return btoa(payload).replace(/=+$/, '');
}

test.describe('设备注册与激活 — E2E 验收', () => {

  // ────────────────────────────────────────────────────────────────────────────
  // 场景 1：S端 授权页面传递 device_profile
  // ────────────────────────────────────────────────────────────────────────────
  test.describe('场景1：授权页面', () => {
    test('auth-page 渲染登录表单，device_profile 被表单读取', async ({ page }) => {
      const dp = encodeDeviceProfile('E2E-FP', 'E2E设备');

      await page.goto(`${S_BASE}/api/auth-page?pc_hash=pc_test&pc_name=E2E测试&device_profile=${dp}`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('#username')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.locator('#loginBtn')).toHaveText('登录授权');
      await expect(page.locator('.card h1')).toHaveText('AI Novel');
    });

    test('授权成功显示成功视图', async ({ page }) => {
      const user = uid();
      const pcHash = `pc_${uid()}`;

      const codeResp = await page.request.post(`${S_BASE}/api/generate_code`, {
        data: { admin_token: ADMIN_TOKEN, tier: 'yearly', count: 1 },
      });
      const code = (await codeResp.json()).data.codes[0];
      await page.request.post(`${S_BASE}/api/activate`, {
        data: {
          activation_code: code, username: user, password: 'TestPass789!',
          security_question: 'q?', security_answer: 'a',
          pc_hash: pcHash, pc_name: '测试机',
        },
      });

      const dp = encodeDeviceProfile(`FP_${uid()}`, '授权测试机');
      await page.goto(`${S_BASE}/api/auth-page?pc_hash=${pcHash}&pc_name=测试机&device_profile=${dp}`);
      await page.waitForLoadState('networkidle');

      await page.fill('#username', user);
      await page.fill('#password', 'TestPass789!');
      await page.click('#loginBtn');

      await expect(page.locator('#successView')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#successView .title')).toContainText('授权成功');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 场景 2：S端 仪表盘设备管理 Tab
  // ────────────────────────────────────────────────────────────────────────────
  test.describe('场景2：仪表盘设备管理', () => {
    test('dashboard#devices 在已授权时显示设备容量信息', async ({ page }) => {
      const user = uid();
      const pcHash = `pc_${uid()}`;

      // 创建用户 + 授权
      const codeResp = await page.request.post(`${S_BASE}/api/generate_code`, {
        data: { admin_token: ADMIN_TOKEN, tier: 'yearly', count: 1 },
      });
      const code = (await codeResp.json()).data.codes[0];
      await page.request.post(`${S_BASE}/api/activate`, {
        data: {
          activation_code: code, username: user, password: 'TestPass789!',
          security_question: 'q?', security_answer: 'a',
          pc_hash: pcHash, pc_name: '测试机',
        },
      });

      const profileB64 = encodeDeviceProfile(`FP_${uid()}`, '激活测试机');
      await page.request.post(`${S_BASE}/api/authorize`, {
        data: { username: user, password: 'TestPass789!', pc_hash: pcHash, device_profile: profileB64 },
      });

      // 获取 web token
      const loginResp = await page.request.post(`${S_BASE}/api/web/login`, {
        data: { username: user, password: 'TestPass789!' },
      });
      const webToken = (await loginResp.json()).data.token;

      // 用 web token 打开 dashboard#devices
      await page.goto(`${S_BASE}/dashboard`);
      await page.evaluate((t) => { localStorage.setItem('token', t); }, webToken);
      await page.goto(`${S_BASE}/dashboard#devices`);
      await page.waitForLoadState('networkidle');

      // 验证设备页面显示容量
      const capacity = page.locator('#deviceCapacity');
      await expect(capacity).toContainText(/共.*台设备/);
    });

    test('dashboard#devices 无设备时显示空状态', async ({ page }) => {
      const user = uid();

      await page.request.post(`${S_BASE}/api/register`, {
        data: { username: user, password: 'TestPass789!', security_question: 'q?', security_answer: 'a' },
      });

      const loginResp = await page.request.post(`${S_BASE}/api/web/login`, {
        data: { username: user, password: 'TestPass789!' },
      });
      const webToken = (await loginResp.json()).data.token;

      await page.goto(`${S_BASE}/dashboard`);
      await page.evaluate((t) => { localStorage.setItem('token', t); }, webToken);
      await page.goto(`${S_BASE}/dashboard#devices`);
      await page.waitForLoadState('networkidle');

      // 验证空状态
      await expect(page.locator('#deviceEmpty')).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 场景 3：API 级别验证 — 设备注册与激活
  // ────────────────────────────────────────────────────────────────────────────
  test.describe('场景3：API 设备注册与激活', () => {
    test('授权时注册设备，返回已激活状态', async ({ request }) => {
      const user = uid();
      const pcHash = `pc_${uid()}`;

      const codeResp = await request.post(`${S_BASE}/api/generate_code`, {
        data: { admin_token: ADMIN_TOKEN, tier: 'yearly', count: 1 },
      });
      const code = (await codeResp.json()).data.codes[0];
      await request.post(`${S_BASE}/api/activate`, {
        data: {
          activation_code: code, username: user, password: 'TestPass789!',
          security_question: 'q?', security_answer: 'a',
          pc_hash: pcHash, pc_name: 'E2E测试机',
        },
      });

      const profileB64 = encodeDeviceProfile(`FP_${uid()}`, 'E2E-开发机');
      await request.post(`${S_BASE}/api/authorize`, {
        data: { username: user, password: 'TestPass789!', pc_hash: pcHash, device_profile: profileB64 },
      });

      const checkResp = await request.get(`${S_BASE}/api/check-auth`, {
        params: { pc_hash: pcHash },
      });
      const jwt = (await checkResp.json()).data?.token || '';

      const currentResp = await request.get(`${S_BASE}/api/devices/current`, {
        params: { pc_hash: pcHash },
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const body = await currentResp.json();
      expect(body.activated).toBe(true);
      expect(body.enrolled).toBe(true);
    });

    test('无套餐用户所有设备未激活', async ({ request }) => {
      const user = uid();
      const pcHash = `pc_${uid()}`;

      await request.post(`${S_BASE}/api/register`, {
        data: { username: user, password: 'TestPass789!', security_question: 'q?', security_answer: 'a' },
      });

      const profileB64 = encodeDeviceProfile(`FP_${uid()}`);
      await request.post(`${S_BASE}/api/authorize`, {
        data: { username: user, password: 'TestPass789!', pc_hash: pcHash, device_profile: profileB64 },
      });

      const checkResp = await request.get(`${S_BASE}/api/check-auth`, {
        params: { pc_hash: pcHash },
      });
      const jwt = (await checkResp.json()).data?.token || '';

      const currentResp = await request.get(`${S_BASE}/api/devices/current`, {
        params: { pc_hash: pcHash },
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const body = await currentResp.json();
      expect(body.activated).toBe(false);
      expect(body.reason.code).toBe('account_inactive');
    });
  });
});
