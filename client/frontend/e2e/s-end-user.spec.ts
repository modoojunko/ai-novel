import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// S端 终端用户路径 E2E 测试
// 覆盖用户路径1（注册）、用户路径2（登录）、用户路径4（重置密码）
//
// 原则:
//   - 全部通过 UI 操作（填写表单、点击按钮、验证页面内容）
//   - 不使用 page.evaluate 或 page.request
//   - 每个测试独立创建所需数据，无需共享种子用户
// ---------------------------------------------------------------------------

const S_BASE = 'http://127.0.0.1:19000';
const C_BASE = 'http://localhost:8000';

function uid(): string {
  return `se2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

test.describe('S端 终端用户路径', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 用户路径1：终端用户注册激活
  // 用户到达 /register → 填写表单 → 注册成功 → Dashboard / 错误提示
  // ──────────────────────────────────────────────────────────────────────────
  test.describe('用户路径1：终端用户注册激活', () => {
    test('注册页面渲染所有表单字段', async ({ page }) => {
      await page.goto(`${S_BASE}/register`);

      await expect(page.locator('#username')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.locator('#confirmPwd')).toBeVisible();
      await expect(page.locator('#question')).toBeVisible();
      await expect(page.locator('#answer')).toBeVisible();
      await expect(page.locator('#btn')).toHaveText('创建账号');
    });

    test('成功注册后跳转到 Dashboard', async ({ page }) => {
      const user = uid();
      await page.goto(`${S_BASE}/register`);

      await page.fill('#username', user);
      await page.fill('#password', 'test123');
      await page.fill('#confirmPwd', 'test123');
      await page.fill('#question', 'pet?');
      await page.fill('#answer', 'dog');
      await page.click('#btn');

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
      await expect(page.locator('.username')).toHaveText(user);
      await expect(page.locator('#codeList')).toContainText('暂无激活记录');
    });

    test('重复用户名显示"用户名已存在"错误提示', async ({ page }) => {
      const user = uid();

      // 首次注册
      await page.goto(`${S_BASE}/register`);
      await page.fill('#username', user);
      await page.fill('#password', 'test123');
      await page.fill('#confirmPwd', 'test123');
      await page.fill('#question', 'q?');
      await page.fill('#answer', 'a');
      await page.click('#btn');
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      // 再次用相同用户名注册 → 应当拒绝
      await page.goto(`${S_BASE}/register`);
      await page.fill('#username', user);
      await page.fill('#password', 'test123');
      await page.fill('#confirmPwd', 'test123');
      await page.fill('#question', 'q?');
      await page.fill('#answer', 'a');
      await page.click('#btn');

      await expect(page.locator('#msg')).toBeVisible();
      await expect(page.locator('#msg')).toHaveText(/已存在/);
    });

    test('密码太短(<6位)显示"密码至少6位"客户端提示', async ({ page }) => {
      await page.goto(`${S_BASE}/register`);
      await page.fill('#username', 'shortpwd_' + Date.now());
      await page.fill('#password', '12345');
      await page.fill('#confirmPwd', '12345');
      await page.fill('#question', 'q?');
      await page.fill('#answer', 'a');
      await page.click('#btn');

      await expect(page.locator('#msg')).toBeVisible();
      await expect(page.locator('#msg')).toHaveText('密码至少6位');
    });

    test('两次密码不一致显示客户端提示', async ({ page }) => {
      await page.goto(`${S_BASE}/register`);
      await page.fill('#username', 'mismatch_' + Date.now());
      await page.fill('#password', 'pass1234');
      await page.fill('#confirmPwd', 'diff_pass');
      await page.fill('#question', 'q?');
      await page.fill('#answer', 'a');
      await page.click('#btn');

      await expect(page.locator('#msg')).toBeVisible();
      await expect(page.locator('#msg')).toHaveText('两次密码不一致');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 用户路径2：终端用户登录使用
  // 用户到达 /login → 输入凭据 → 登录成功 → Dashboard / 错误提示
  // ──────────────────────────────────────────────────────────────────────────
  test.describe('用户路径2：终端用户登录使用', () => {
    test('登录页面渲染用户名和密码字段', async ({ page }) => {
      await page.goto(`${S_BASE}/login`);

      await expect(page.locator('#username')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.locator('#btn')).toHaveText('登录');
      await expect(page.getByText('登录你的账号')).toBeVisible();
    });

    test('成功登录后跳转到 Dashboard', async ({ page }) => {
      const user = uid();

      // 先通过注册创建用户
      await page.goto(`${S_BASE}/register`);
      await page.fill('#username', user);
      await page.fill('#password', 'mypass987');
      await page.fill('#confirmPwd', 'mypass987');
      await page.fill('#question', 'city?');
      await page.fill('#answer', 'tokyo');
      await page.click('#btn');
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      // 退出到登录页，用刚才的用户登录
      await page.goto(`${S_BASE}/login`);
      await page.fill('#username', user);
      await page.fill('#password', 'mypass987');
      await page.click('#btn');

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
      await expect(page.locator('.username')).toHaveText(user);
    });

    test('密码错误显示"用户名或密码错误"提示', async ({ page }) => {
      await page.goto(`${S_BASE}/login`);
      await page.fill('#username', 'nonexistent_' + uid());
      await page.fill('#password', 'wrong_password');
      await page.click('#btn');

      await expect(page.locator('#msg')).toBeVisible();
      await expect(page.locator('#msg')).toHaveText('用户名或密码错误');
    });

    test('未注册用户登录显示错误提示', async ({ page }) => {
      await page.goto(`${S_BASE}/login`);
      await page.fill('#username', 'never_registered_user');
      await page.fill('#password', 'somepass123');
      await page.click('#btn');

      await expect(page.locator('#msg')).toBeVisible();
      await expect(page.locator('#msg')).toHaveText('用户名或密码错误');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 用户路径4：终端用户重置密码
  // 用户到达 /reset-password → 输入用户名 → 密保答案+新密码 → 成功/失败
  // 注意: C端 resetPassword 服务依赖 config.json 中的 username，
  //       该值在正常 OAuth 流程中未被持久化。
  //       因此涉及后端 API 交互的测试标记为 fixme，
  //       待后端修复(browser_auth 中保存 username / 路由使用请求中的用户名)后激活。
  // ──────────────────────────────────────────────────────────────────────────
  test.describe('用户路径4：终端用户重置密码', () => {
    test('重置密码页面渲染用户名输入框和下一步按钮', async ({ page }) => {
      await page.goto(`${C_BASE}/#/reset-password`);

      await expect(page.getByRole('heading', { name: '重置密码' })).toBeVisible();
      await expect(page.getByText('用户名')).toBeVisible();
      await expect(page.getByRole('button', { name: '下一步' })).toBeVisible();
      await expect(page.getByText('返回登录')).toBeVisible();
    });

    test('输入用户名后进入密保答案和新密码步骤', async ({ page }) => {
      await page.goto(`${C_BASE}/#/reset-password`);

      // 第一步：输入用户名
      await page.locator('.card-body input').first().fill('test_user');
      await page.getByRole('button', { name: '下一步' }).click();

      // 第二步：显示密保答案和新密码字段
      await expect(page.getByText('密保答案')).toBeVisible();
      await expect(page.getByText('新密码')).toBeVisible();
      await expect(page.getByRole('button', { name: '重置' })).toBeVisible();
      await expect(page.getByText(/用户:/)).toBeVisible();
    });

    test('空用户名提交显示客户端验证错误', async ({ page }) => {
      await page.goto(`${C_BASE}/#/reset-password`);

      await page.getByRole('button', { name: '下一步' }).click();

      await expect(page.locator('.text-error')).toBeVisible();
      await expect(page.locator('.text-error')).toHaveText('请输入用户名');
    });

    test('空密保答案显示客户端验证错误', async ({ page }) => {
      await page.goto(`${C_BASE}/#/reset-password`);

      // 进入第二步
      await page.locator('.card-body input').first().fill('test_user');
      await page.getByRole('button', { name: '下一步' }).click();

      // 不填密保答案直接点重置
      await page.getByRole('button', { name: '重置' }).click();

      await expect(page.locator('.text-error')).toBeVisible();
      await expect(page.locator('.text-error')).toHaveText('请输入密保答案');
    });

    test('密码太短显示客户端验证错误', async ({ page }) => {
      await page.goto(`${C_BASE}/#/reset-password`);

      // 进入第二步
      await page.locator('.card-body input').first().fill('test_user');
      await page.getByRole('button', { name: '下一步' }).click();

      // 填入密保答案但密码太短
      await page.getByRole('textbox').first().fill('my_answer');
      await page.getByPlaceholder('至少 6 位').fill('123');
      await page.getByRole('button', { name: '重置' }).click();

      await expect(page.locator('.text-error')).toBeVisible();
      await expect(page.locator('.text-error')).toHaveText('密码至少 6 位');
    });

    // C端 resetPassword 服务从 config.json 读取 username，
    // 但 username 在正常 DEV_MODE / OAuth 流程中未被持久化。
    // 同时路由处理函数接收了请求中的 username 却未传递给 service。
    // 修复路径: (1) service.reset_password 改为接受 username 参数
    //           (2) router 将 req.username 传递给 service
    //           (3) browser_auth 中将 username 保存到 config
    test.fixme('正确密保答案可成功重置密码', async ({ page }) => {
      const user = uid();

      // 通过 S端 注册创建用户
      await page.goto(`${S_BASE}/register`);
      await page.fill('#username', user);
      await page.fill('#password', 'oldPass1');
      await page.fill('#confirmPwd', 'oldPass1');
      await page.fill('#question', '最喜欢的宠物？');
      await page.fill('#answer', 'dog');
      await page.click('#btn');
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      // 跳转到 C端 重置密码页面
      await page.goto(`${C_BASE}/#/reset-password`);

      // 第一步：输入用户名
      await page.locator('.card-body input').first().fill(user);
      await page.getByRole('button', { name: '下一步' }).click();

      // 第二步：输入密保答案和新密码
      await page.getByRole('textbox').first().fill('dog');
      await page.getByPlaceholder('至少 6 位').fill('newPass2');
      await page.getByRole('button', { name: '重置' }).click();

      // 成功后显示"密码已重置"页面
      await expect(page.getByRole('heading', { name: '密码已重置' })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('去登录')).toBeVisible();
    });

    test.fixme('错误密保答案显示错误提示', async ({ page }) => {
      const user = uid();

      // 通过 S端 注册创建用户
      await page.goto(`${S_BASE}/register`);
      await page.fill('#username', user);
      await page.fill('#password', 'test123');
      await page.fill('#confirmPwd', 'test123');
      await page.fill('#question', 'pet?');
      await page.fill('#answer', 'dog');
      await page.click('#btn');
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      // 跳转到 C端 重置密码页面
      await page.goto(`${C_BASE}/#/reset-password`);

      // 第一步：输入用户名
      await page.locator('.card-body input').first().fill(user);
      await page.getByRole('button', { name: '下一步' }).click();

      // 第二步：输入错误密保答案
      await page.getByRole('textbox').first().fill('cat'); // wrong answer
      await page.getByPlaceholder('至少 6 位').fill('newPass2');
      await page.getByRole('button', { name: '重置' }).click();

      // 显示错误信息
      await expect(page.locator('.text-error')).toBeVisible({ timeout: 10000 });
    });

    test('返回登录链接可点击', async ({ page }) => {
      await page.goto(`${C_BASE}/#/reset-password`);

      await page.getByText('返回登录').click();

      // 等待 hash 路由跳转到登录页
      await expect(page).toHaveURL(/#\/login/);
    });
  });
});
