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
