import { test, expect } from '../fixtures'

test.describe('控制台首页', () => {
  test.beforeEach(async ({ page, mockApi }) => {
    mockApi.registerUser()
    mockApi.setMembership({ tier: 'free', remaining_sec: 0, remaining_desc: '0 天' })
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/dashboard')
  })

  test('问候语与日期', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: /你好/ })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/星期/)).toBeVisible()
  })

  test('续费按钮跳收银台', async ({ page }) => {
    await page.getByRole('button', { name: '续费或购买时长' }).click()
    await expect(page).toHaveURL(/\/pay/)
  })

  test('我的套餐卡（免费态）', async ({ page }) => {
    await expect(page.getByRole('main').getByText('我的套餐')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('当前无生效中的套餐时长')).toBeVisible()
  })

  test('我的套餐卡（试用临期态 + 横幅）', async ({ page, mockApi }) => {
    mockApi.setMembership({ tier: 'trial', remaining_sec: 2 * 86400, remaining_desc: '2 天' })
    await page.reload()
    await expect(page.getByText('试用 · 剩 2 天')).toBeVisible({ timeout: 10000 })
    // 试用临期横幅（优先级低于退款处理中）
    await expect(page.getByText(/试用还剩 2 天/)).toBeVisible()
  })

  test('退款处理中横幅（最高优先级）', async ({ page, mockApi }) => {
    mockApi.setMembership({ tier: 'trial', remaining_sec: 2 * 86400, remaining_desc: '2 天' })
    mockApi.setOrders([{
      order_no: 'SORDER-REFUND-0001',
      status: 'refund_processing',
      amount_fen: 2400,
      snapshot: { tier_display: 'PRO', period: 'monthly', period_days: 30 },
      created_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
      refunded_at: '',
      refund_amount_fen: 776,
    }])
    await page.reload()
    await expect(page.getByText(/您有一笔退款正在处理中（预计退 ¥7\.76/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/试用还剩/)).toHaveCount(0) // 退款横幅优先，试用横幅不出现
  })

  test('设备概览卡', async ({ page }) => {
    await expect(page.getByText(/台/).first()).toBeVisible()
    await page.getByRole('button', { name: '管理设备' }).click()
    await expect(page).toHaveURL(/\/dashboard\/devices/)
  })

  test('下载客户端入口打开下载弹窗', async ({ page }) => {
    await expect(page.getByText('下载客户端')).toBeVisible()
    await page.getByRole('button', { name: 'Windows 版' }).click()
    await expect(page.locator('.mcard')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('link', { name: /下载 Windows/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /下载 macOS/ })).toBeVisible()
  })

  test('账户卡修改密码入口', async ({ page }) => {
    await page.getByRole('button', { name: '修改密码' }).click()
    await expect(page).toHaveURL(/\/dashboard\/account/)
  })

  test('导航含我的套餐与我的订单', async ({ page }) => {
    await expect(page.locator('nav.nav a:has-text("我的套餐")')).toBeVisible()
    await expect(page.locator('nav.nav a:has-text("我的订单")')).toBeVisible()
    await page.locator('nav.nav a:has-text("我的订单")').click()
    await expect(page).toHaveURL(/\/dashboard\/orders/)
  })
})
