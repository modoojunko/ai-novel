import { test, expect } from '../fixtures'

test.describe('登录回跳', () => {
  test('未登录访问 /pay 跳登录并带 redirect', async ({ page }) => {
    await page.goto('/pay')
    await expect(page).toHaveURL(/\/login\?redirect=\/pay/, { timeout: 15000 })
  })

  test('未登录访问订单详情跳登录并带 redirect', async ({ page }) => {
    await page.goto('/dashboard/orders/S20260830143000ABC123')
    await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 15000 })
    await expect(page).toHaveURL(/orders%2FS20260830143000ABC123|orders\/S20260830143000ABC123/)
  })

  test('登录成功回跳 /pay', async ({ page, mockApi }) => {
    mockApi.registerUser()
    await page.goto('/pay')
    await expect(page).toHaveURL(/\/login\?redirect=\/pay/, { timeout: 15000 })
    await page.getByLabel(/用户名/).fill(mockApi.currentUser!.username)
    await page.getByLabel(/密码/).fill(mockApi.currentUser!.password)
    await page.getByRole('button', { name: /登录|登 录/ }).click()
    // 回跳后落在收银台
    await expect(page).toHaveURL(/\/pay$/, { timeout: 15000 })
    await expect(page.getByText('升级套餐，解锁全部写作能力')).toBeVisible({ timeout: 10000 })
  })
})
