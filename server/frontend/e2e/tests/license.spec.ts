import { test, expect } from '../fixtures'

test.describe('License 页', () => {
  test.beforeEach(async ({ page, mockApi }) => {
    mockApi.registerUser()
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/dashboard/license')
  })

  test('页面标题和说明文字', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard\/license/, { timeout: 15000 })
    await expect(page.getByText('我的 License').first()).toBeVisible()
    await expect(page.getByText('激活码用于开通或延长套餐')).toBeVisible()
  })

  test('License 卡片展示套餐信息', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '试用' })).toBeVisible()
    await expect(page.getByText('有效期内')).toBeVisible()
  })

  test('激活码列表显示预留空态', async ({ page }) => {
    await expect(page.getByText('激活码明细即将上线')).toBeVisible()
  })

  test('激活新码按钮打开模态', async ({ page }) => {
    await page.getByRole('button', { name: '激活新码' }).click()
    await expect(page.getByText('激活 License')).toBeVisible()
  })

  test('激活码成功提交', async ({ page }) => {
    await page.getByRole('button', { name: '激活新码' }).click()
    await page.getByLabel('激活码').fill('AC-YEAR-2026-1234-5678')
    await page.getByRole('button', { name: '确认激活' }).click()
    await expect(page.getByText('激活成功').first()).toBeVisible()
  })
})
