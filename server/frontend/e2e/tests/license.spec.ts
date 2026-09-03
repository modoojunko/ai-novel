import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import type { MockApi } from '../mocks/api-handlers'

function order(overrides: Partial<Parameters<MockApi['setOrders']>[0][number]> = {}): Parameters<MockApi['setOrders']>[0][number] {
  return {
    order_no: 'S20260902TEST0001',
    status: 'fulfilled',
    amount_fen: 3000,
    snapshot: { tier_display: 'PRO', tier_key: 'pro', period: 'monthly', period_days: 30 },
    created_at: '2026-09-02T08:52:00Z',
    paid_at: '2026-09-02T08:53:00Z',
    refunded_at: '',
    refund_amount_fen: null,
    ...overrides,
  }
}

async function gotoLicense(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('token', 'e2e-token'))
  await page.goto('/dashboard/license')
}

test.describe('我的套餐明细与激活（s-pay-post-purchase-completion）', () => {
  test.beforeEach(async ({ mockApi }) => {
    mockApi.registerUser()
  })

  test('空态：名下无套餐行显示引导购买', async ({ page }) => {
    await gotoLicense(page)
    await expect(page.getByText('还没有生效中的套餐')).toBeVisible({ timeout: 10000 })
  })

  test('待激活行可见 → 确认激活 → 转生效中', async ({ page, mockApi }) => {
    mockApi.setOrders([order()])
    await gotoLicense(page)
    // 明细行 + 页头待激活计数一致
    await expect(page.getByText('套餐明细')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('PRO · 30 天')).toBeVisible()
    await expect(page.getByText('待激活', { exact: true })).toBeVisible()
    await expect(page.locator('.sum')).toContainText('1 个')
    await expect(page.getByText(/不计时、不占额度/)).toBeVisible()
    // 确认弹层讲清两条后果
    await page.getByRole('button', { name: '激活', exact: true }).click()
    await expect(page.getByText('确认激活套餐')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/立即开始计时/)).toBeVisible()
    await expect(page.getByText(/按已使用时长折算/)).toBeVisible()
    await page.getByRole('button', { name: '确认激活' }).click()
    // 成功后行转生效中、待激活入口消失
    await expect(page.getByText('激活成功，套餐已开始计时')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('生效中').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '激活', exact: true })).toHaveCount(0)
  })

  test('不可激活给出原因与联系客服出口', async ({ page, mockApi }) => {
    mockApi.setOrders([order()])
    mockApi.failActivate('not_activatable')
    await gotoLicense(page)
    await page.getByRole('button', { name: '激活', exact: true }).click({ timeout: 10000 })
    await page.getByRole('button', { name: '确认激活' }).click()
    await expect(page.getByText(/该套餐当前不能激活/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('联系客服')).toBeVisible()
  })

  test('已收回套餐灰显可见、无操作按钮', async ({ page, mockApi }) => {
    mockApi.setLicense({
      tier: 'free',
      remaining_sec: 0,
      remaining_desc: '0 天',
      pending_count: 0,
      grants: [{
        code_id: 'O-S20260902REFUND01',
        order_no: 'S20260902REFUND01',
        tier: 'pro',
        duration_days: 30,
        status: 'revoked',
        activated_at: '',
        expires_at: '',
        grant_start: '',
      }],
    })
    await gotoLicense(page)
    await expect(page.getByText('已随退款收回')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('已收回', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '激活' })).toHaveCount(0)
  })
})
