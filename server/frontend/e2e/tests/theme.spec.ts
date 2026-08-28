// theme-preferences e2e：登录应用已存主题 / 选择器即时生效+持久化 / 刷新保持 / 登出回落默认
import { test, expect } from '../fixtures'

test.describe('界面主题', () => {

  test('已存主题随登录应用（不闪默认）', async ({ page, mockApi }) => {
    mockApi.registerUser({ theme: 'ink' })
    await page.goto('/login')
    await page.getByLabel('用户名').fill(mockApi.currentUser!.username)
    await page.locator('input[aria-label="密码"]').fill(mockApi.currentUser!.password)
    await page.locator('button:has-text("登录")').click()
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'ink')
  })

  test('选择器切换即时生效并持久化，刷新保持', async ({ page, mockApi }) => {
    mockApi.registerUser()
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/dashboard/account')
    await page.getByRole('heading', { name: '账户设置' }).waitFor({ timeout: 15000 })

    await page.locator('.sw', { hasText: '竹青' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'bamboo')
    await expect(mockApi.currentUser!.theme).toBe('bamboo')

    // 刷新：me 读回持久化主题
    await page.reload()
    await page.getByRole('heading', { name: '账户设置' }).waitFor({ timeout: 15000 })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'bamboo')
  })

  test('切回默认 = 移除属性', async ({ page, mockApi }) => {
    mockApi.registerUser({ theme: 'rouge' })
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/dashboard/account')
    await page.getByRole('heading', { name: '账户设置' }).waitFor({ timeout: 15000 })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'rouge')

    await page.locator('.sw', { hasText: '默认' }).click()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'rouge')
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
    await expect(mockApi.currentUser!.theme).toBe('teal')
  })

  test('保存失败可重试并落库（重试不因视觉已切而空转）', async ({ page, mockApi }) => {
    mockApi.registerUser()
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/dashboard/account')
    await page.getByRole('heading', { name: '账户设置' }).waitFor({ timeout: 15000 })

    // 两次失败：第一次被 saveTheme 的自动重试吃掉，第二次失败后才弹通知
    mockApi.failPreferences(2)
    await page.locator('.sw', { hasText: '竹青' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'bamboo')
    const retryLink = page.locator('.notice.err .lnk')
    await expect(retryLink).toBeVisible()
    expect(mockApi.currentUser!.theme).toBe('teal')

    // 手动重试 → PUT 真正重发并成功，通知消失、落库生效
    await retryLink.click()
    await expect(page.locator('.notice.err')).toHaveCount(0)
    expect(mockApi.currentUser!.theme).toBe('bamboo')
  })

  test('冷启动网络失败自愈：自动重试一次成功，不打扰用户', async ({ page, mockApi }) => {
    mockApi.registerUser()
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/dashboard/account')
    await page.getByRole('heading', { name: '账户设置' }).waitFor({ timeout: 15000 })

    // 一次无响应网络失败（= 冷启动 503 无 CORS 的浏览器侧形态）
    mockApi.failPreferences(1, 'network')
    await page.locator('.sw', { hasText: '胭脂' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'rouge')

    // 自动重试（300ms 延迟）后落库成功；全程无错误通知
    await expect.poll(() => mockApi.currentUser!.theme).toBe('rouge')
    await expect(page.locator('.notice.err')).toHaveCount(0)
  })

  test('登出回落默认主题', async ({ page, mockApi }) => {
    mockApi.registerUser({ theme: 'ink' })
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/dashboard')
    await page.getByRole('heading', { name: '首页' }).waitFor({ timeout: 15000 })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'ink')

    // 顶栏退出（ui.spec 既有定位口径）
    await page.locator('header.appbar button:has-text("退出登录")').click()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
  })

  test('落地页不受主题影响（默认渲染）', async ({ page, mockApi }) => {
    mockApi.registerUser({ theme: 'wisteria' })
    await page.goto('/')
    // 残留 token 也会触发 me 拉取（头部登录态），但主题只作用于控制台
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
  })
})
