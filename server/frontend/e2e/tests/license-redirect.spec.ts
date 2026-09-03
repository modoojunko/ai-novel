import { test, expect } from '../fixtures'

/**
 * 命名对齐（s-pay-license-naming）：
 * /dashboard/membership 旧链接重定向到 /dashboard/license 真身页；
 * 历史激活码入口（8.3 拆除）的书签原路径 /dashboard/license 即本页，激活码 UI 保持移除。
 */
test.describe('membership 旧链接重定向', () => {
  test.beforeEach(async ({ page, mockApi }) => {
    mockApi.registerUser()
    mockApi.setLicense({ tier: 'free', remaining_sec: 0, remaining_desc: '0 天' })
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
  })

  test('/dashboard/membership → /dashboard/license', async ({ page }) => {
    await page.goto('/dashboard/membership')
    await expect(page).toHaveURL(/\/dashboard\/license/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: '我的套餐' })).toBeVisible({ timeout: 10000 })
  })

  test('激活码 UI 全部移除', async ({ page }) => {
    await page.goto('/dashboard/license')
    await expect(page.getByText(/激活码/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: '激活新码' })).toHaveCount(0)
  })
})
