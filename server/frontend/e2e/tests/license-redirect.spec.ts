import { test, expect } from '../fixtures'

/**
 * 激活码入口拆除（s-pay-foundation 8.3）：
 * /dashboard/license 老链接重定向到我的套餐，License 页与激活码表单整体移除。
 */
test.describe('旧 License 链接重定向', () => {
  test.beforeEach(async ({ page, mockApi }) => {
    mockApi.registerUser()
    mockApi.setMembership({ tier: 'free', remaining_sec: 0, remaining_desc: '0 天' })
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
  })

  test('/dashboard/license → /dashboard/membership', async ({ page }) => {
    await page.goto('/dashboard/license')
    await expect(page).toHaveURL(/\/dashboard\/membership/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: '我的套餐' })).toBeVisible({ timeout: 10000 })
  })

  test('激活码 UI 全部移除', async ({ page }) => {
    await page.goto('/dashboard/membership')
    await expect(page.getByText(/激活码/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: '激活新码' })).toHaveCount(0)
  })
})
