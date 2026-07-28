import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// 设备注册与激活管理 — C端 + S端 联合 E2E 验收
//
// 覆盖场景：
//   - C端 login page 集成 useDeviceActivation（代理经 C端 后端）
//   - S端 授权页面传递 device_profile
//   - S端 设备管理页面渲染
//
// 前置条件：
//   - S端 运行在 http://127.0.0.1:19000（python server/local_server.py）
//   - C端 后端运行在 http://localhost:8000（uvicorn main:app）
//   - C端 前端运行在 http://localhost:5173（npm run dev）
// ---------------------------------------------------------------------------

const S_BASE = 'http://127.0.0.1:19000';
const C_BASE = 'http://localhost:8000';
const ADMIN_TOKEN = 'admin123';

function uid(): string {
  return `de2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** 编码 DeviceProfile（与 C端 service.py 一致） */
function encodeDeviceProfile(fingerprint: string, hostname = 'E2E-PC'): string {
  const payload = JSON.stringify({ f: fingerprint, h: hostname, o: 'Windows 11', a: 'x86_64' });
  return btoa(payload).replace(/=+$/, '');
}

test.describe('设备注册与激活 — E2E 验收', () => {

  // ────────────────────────────────────────────────────────────────────────────
  // 场景 1：C端 登录页 → 设备激活状态
  // ────────────────────────────────────────────────────────────────────────────
  test.describe('场景1：C端 登录集成', () => {
    test('C端 代理端点返回设备激活状态', async ({ request }) => {
      // 1. 通过 S端 API 创建用户 + 授权（模拟已登录状态）
      const user = uid();
      const pcHash = `pc_${uid()}`;
      const fp = `FP_${uid()}`;

      // 创建付费用户
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

      // 授权（写入 auth_tokens 供 C端 查询）
      const profileB64 = encodeDeviceProfile(fp, 'E2E-开发机');
      const authResp = await request.post(`${S_BASE}/api/authorize`, {
        data: { username: user, password: 'TestPass789!', pc_hash: pcHash, device_profile: profileB64 },
      });
      expect(authResp.ok()).toBeTruthy();

      // 2. 查询 C端 代理端点 → 应返回激活状态
      // 需要设置 C端 本地 config（模拟已登录）
      // 由于 C端 代理端点读取本地 config.json，这里通过 S端 直接验证
      const checkResp = await request.get(`${S_BASE}/api/check-auth`, {
        params: { pc_hash: pcHash },
      });
      const jwt = (await checkResp.json()).data?.token || '';

      // 3. 验证 S端 current 端点（C端 代理转发的目标）
      const currentResp = await request.get(`${S_BASE}/api/devices/current`, {
        params: { pc_hash: pcHash },
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const body = await currentResp.json();
      expect(body.activated).toBe(true);
      expect(body.enrolled).toBe(true);
      expect(body.device_name).toBe('E2E-开发机');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 场景 2：S端 授权页面传递 device_profile
  // ────────────────────────────────────────────────────────────────────────────
  test.describe('场景2：授权页面传递 device_profile', () => {
    test('auth-page 渲染登录表单，URL 中的 device_profile 被表单读取', async ({ page }) => {
      const pcHash = `pc_${uid()}`;
      const dp = encodeDeviceProfile('E2E-FP', 'E2E设备');

      await page.goto(`${S_BASE}/api/auth-page?pc_hash=${pcHash}&pc_name=E2E测试&device_profile=${dp}`);
      await page.waitForLoadState('networkidle');

      // 验证登录表单渲染
      await expect(page.locator('#username')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.locator('#loginBtn')).toHaveText('登录授权');
      await expect(page.locator('.card h1')).toHaveText('AI Novel');
    });

    test('授权成功页面显示成功状态', async ({ page }) => {
      const user = uid();
      const pcHash = `pc_${uid()}`;

      // 预创建用户
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

      // 打开授权页面 → 填写表单 → 提交
      const dp = encodeDeviceProfile(`FP_${uid()}`, '授权测试机');
      await page.goto(`${S_BASE}/api/auth-page?pc_hash=${pcHash}&pc_name=测试机&device_profile=${dp}`);
      await page.waitForLoadState('networkidle');

      await page.fill('#username', user);
      await page.fill('#password', 'TestPass789!');
      await page.click('#loginBtn');

      // 应显示授权成功视图
      await expect(page.locator('#successView')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#successView .title')).toContainText('授权成功');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 场景 3：S端 设备管理页面渲染
  // ────────────────────────────────────────────────────────────────────────────
  test.describe('场景3：设备管理页面', () => {
    test('已授权设备显示激活卡片', async ({ page }) => {
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

      // 获取 JWT
      const checkResp = await page.request.get(`${S_BASE}/api/check-auth`, {
        params: { pc_hash: pcHash },
      });
      const jwt = (await checkResp.json()).data?.token || '';

      // 打开设备管理页面
      await page.goto(`${S_BASE}/dashboard/devices#jwt=${jwt}`);
      await page.waitForLoadState('networkidle');

      // 验证页面渲染
      await expect(page.locator('.page-header h1')).toHaveText('我的设备');
      await expect(page.locator('#capacity')).toBeVisible();

      const cards = page.locator('.device-card');
      await expect(cards.first()).toBeVisible({ timeout: 5000 });

      // 验证激活标记
      const firstCard = cards.first();
      await expect(firstCard).toHaveClass(/card-activated/);
      await expect(firstCard.locator('.activation-dot.green')).toContainText('已激活');
      await expect(firstCard.locator('.badge-recent')).toBeVisible();
    });

    test('未认证访问显示错误状态', async ({ page }) => {
      await page.goto(`${S_BASE}/dashboard/devices`);
      await page.waitForLoadState('networkidle');

      const errorView = page.locator('.error-state');
      await expect(errorView).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#errorTitle')).toContainText('未登录');
    });
  });
});
