import { test, expect } from '../fixtures'

function setToken(page: any, mockApi: any) {
  return page.evaluate((token: string) => localStorage.setItem('token', token), mockApi.token)
}

test.describe('UI 基础设施', () => {
  test.describe('主题切换', () => {
    test('默认主题为 parchment', async ({ page }) => {
      await page.goto('/')
      const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
      expect(theme).toBe('parchment')
    })

    test('主题切换按钮存在', async ({ page }) => {
      await page.goto('/')
      const toggleBtn = page.locator('.navbar button[aria-label*="主题"]')
      await expect(toggleBtn).toBeVisible()
    })

    test('点击切换主题', async ({ page }) => {
      await page.goto('/')
      await page.locator('.navbar button[aria-label*="主题"]').click()
      const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
      expect(theme).toBe('novelforge')
    })

    test('主题持久化', async ({ page }) => {
      await page.goto('/')
      await page.locator('.navbar button[aria-label*="主题"]').click()
      const saved = await page.evaluate(() => localStorage.getItem('theme'))
      expect(saved).toBe('novelforge')
    })

    test('再次点击恢复', async ({ page }) => {
      await page.goto('/')
      await page.locator('.navbar button[aria-label*="主题"]').click()
      await page.locator('.navbar button[aria-label*="主题"]').click()
      const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
      expect(theme).toBe('parchment')
    })
  })

  test.describe('导航栏', () => {
    test('Logo 显示', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('爱小说').first()).toBeVisible()
    })

    test('侧栏导航菜单', async ({ page, mockApi }) => {
      mockApi.registerUser()
      await page.goto('/')
      await setToken(page, mockApi)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 })
      await expect(page.locator('aside a:has-text("首页")')).toBeVisible()
      await expect(page.locator('aside a:has-text("License")')).toBeVisible()
      await expect(page.locator('aside a:has-text("设备")')).toBeVisible()
      await expect(page.locator('aside a:has-text("账户")')).toBeVisible()
    })

    test('侧栏底部用户信息', async ({ page, mockApi }) => {
      const user = mockApi.registerUser()
      await page.goto('/')
      await setToken(page, mockApi)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 })
      await expect(page.locator('aside').getByText(user.username)).toBeVisible()
    })

    test('侧栏退出按钮', async ({ page, mockApi }) => {
      mockApi.registerUser()
      await page.goto('/')
      await setToken(page, mockApi)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 })
      await page.locator('aside button:has-text("退出登录")').click()
      await expect(page).toHaveURL('/')
      const token = await page.evaluate(() => localStorage.getItem('token'))
      expect(token).toBeNull()
    })
  })

  test.describe('API 401 拦截', () => {
    test('过期 token 触发登出', async ({ page, mockApi }) => {
      // mockApi 注册路由但不创建用户 → /user/me 返回 401
      // 需要先调用 setup()（fixture 已经自动调用）
      await page.goto('/')
      await page.evaluate(() => localStorage.setItem('token', 'expired_jwt_token'))
      await page.goto('/dashboard')
      // 路由守卫使用 localStorage token → 进入 dashboard
      // /user/me 返回 401（mock 无 currentUser）→ 拦截器触发登出 → 跳转 /login
      await expect(page).toHaveURL(/\/login/, { timeout: 20000 })
    })
  })
})
