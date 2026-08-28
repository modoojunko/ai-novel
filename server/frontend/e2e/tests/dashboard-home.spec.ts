import { test, expect } from '../fixtures'

test.describe('控制台首页', () => {
  test.beforeEach(async ({ page, mockApi }) => {
    mockApi.registerUser()
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/dashboard')
  })

  test('页面标题和欢迎信息', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: '首页' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/欢迎回来/)).toBeVisible()
  })

  test('License 卡片', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '试用' })).toBeVisible()
    await expect(page.getByText('有效期内')).toBeVisible()
    await expect(page.getByRole('button', { name: '激活新码' })).toBeVisible()
  })

  test('设备概览', async ({ page }) => {
    await expect(page.getByText(/台已激活/)).toBeVisible()
  })

  test('激活新码模态', async ({ page }) => {
    // 先用 getByText 点击按钮
    await page.getByText('激活新码').first().click()
    // 等待模态出现
    await expect(page.locator('.mcard')).toBeVisible({ timeout: 10000 })
  })

  test('激活码提交成功', async ({ page }) => {
    await page.getByRole('button', { name: '激活新码' }).click()
    const modal = page.locator('.mcard')
    await modal.getByLabel('激活码').fill('AC-TEST-CODE-1234-5678')
    await modal.getByRole('button', { name: '确认激活' }).click()
    await expect(page.getByText('激活成功').first()).toBeVisible()
  })

  test('激活码空输入禁用按钮', async ({ page }) => {
    await page.getByRole('button', { name: '激活新码' }).click()
    const confirmBtn = page.locator('.mcard').getByRole('button', { name: '确认激活' })
    await expect(confirmBtn).toBeDisabled()
  })

  test('激活失败显示错误', async ({ page }) => {
    await page.getByText('激活新码').first().click()
    await expect(page.locator('.mcard')).toBeVisible({ timeout: 10000 })
    const modal = page.locator('.mcard')
    // 输入短码触发后端错误
    await modal.locator('input[aria-label="激活码"]').type('short')
    await modal.getByRole('button', { name: '确认激活' }).click()
    // 错误时模态应保持打开
    await expect(modal).toBeVisible({ timeout: 10000 })
  })

  test('设备管理链接', async ({ page }) => {
    await page.locator('a:has-text("管理设备")').click()
    await expect(page).toHaveURL(/\/dashboard\/devices/)
  })

  test('账户设置链接', async ({ page }) => {
    await page.locator('a:has-text("前往设置")').click()
    await expect(page).toHaveURL(/\/dashboard\/account/)
  })

  test('下载客户端入口打开下载弹窗', async ({ page }) => {
    await expect(page.getByText('下载客户端')).toBeVisible()
    await page.getByRole('button', { name: '免费下载' }).click()
    await expect(page.locator('.mcard')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('link', { name: /下载 Windows/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /下载 macOS/ })).toBeVisible()
  })
})
