import { test, expect } from '../fixtures'

test.describe('路由守卫', () => {
  test.describe('正向守卫：requiresAuth', () => {
    test('未登录访问 /dashboard 跳转到 /login', async ({ page }) => {
      await page.goto('/dashboard')
      // URL 中被 redirect= 的值是未编码的 /dashboard
      await expect(page).toHaveURL(/\/login\?redirect=\/dashboard$/, { timeout: 15000 })
    })

    test('未登录访问 /dashboard/license 跳转到 /login', async ({ page }) => {
      await page.goto('/dashboard/license')
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
    })

    test('未登录访问 /dashboard/devices 跳转到 /login', async ({ page }) => {
      await page.goto('/dashboard/devices')
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
    })

    test('未登录访问 /dashboard/account 跳转到 /login', async ({ page }) => {
      await page.goto('/dashboard/account')
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
    })

    test('已登录访问 dashboard 正常渲染', async ({ page, mockApi }) => {
      mockApi.registerUser()
      await page.goto('/')
      await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
      // 验证 token 已存储
      const storedToken = await page.evaluate(() => localStorage.getItem('token'))
      expect(storedToken).toBeTruthy()
      // 导航到 dashboard
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 })
      await expect(page.locator('h1')).toHaveText('首页', { timeout: 15000 })
    })
  })

  test.describe('反向守卫：guestOnly', () => {
    test('已登录访问 /login 静默跳转 /dashboard', async ({ page, mockApi }) => {
      mockApi.registerUser()
      await page.goto('/')
      const storedToken = await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
      await page.goto('/login')
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 })
    })

    test('已登录访问 /register 静默跳转 /dashboard', async ({ page, mockApi }) => {
      mockApi.registerUser()
      await page.goto('/')
      await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
      await page.goto('/register')
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 })
    })

    test('未登录访问 /login 正常显示', async ({ page }) => {
      await page.goto('/login')
      await expect(page.getByText('登录').first()).toBeVisible({ timeout: 10000 })
    })

    test('未登录访问 /register 正常显示', async ({ page }) => {
      await page.goto('/register')
      await expect(page.getByRole('heading', { name: '注册' })).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('404 页面', () => {
    test('不存在的路径显示 404', async ({ page }) => {
      await page.goto('/this-path-does-not-exist')
      await expect(page.getByText('404').first()).toBeVisible()
      await expect(page.getByText('页面不存在')).toBeVisible()
    })

    test('404 页面的「返回首页」按钮', async ({ page }) => {
      await page.goto('/non-existent-page')
      await page.getByRole('link', { name: '返回首页' }).click()
      await expect(page).toHaveURL('/')
    })
  })
})
