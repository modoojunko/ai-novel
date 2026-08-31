import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import type { MockApi } from '../mocks/api-handlers'

/** 建一条可复用的已支付订单 */
function paidOrder(overrides: Partial<Parameters<MockApi['setOrders']>[0][number]> = {}): Parameters<MockApi['setOrders']>[0][number] {
  return {
    order_no: 'S20260830143000ABC123',
    status: 'fulfilled',
    amount_fen: 7200,
    snapshot: { tier_display: 'PRO', period: 'quarterly', period_days: 90 },
    created_at: '2026-08-30T06:22:00Z',
    paid_at: '2026-08-30T06:24:00Z',
    refunded_at: '',
    refund_amount_fen: null,
    ...overrides,
  }
}

async function gotoOrders(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('token', 'e2e-token'))
  await page.goto('/dashboard/orders')
}

test.describe('我的订单', () => {
  test('空态引导购买', async ({ page, mockApi }) => {
    mockApi.registerUser()
    await gotoOrders(page)
    await expect(page.getByText('还没有订单')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: '去购买套餐' }).click()
    await expect(page).toHaveURL(/\/pay/)
  })

  test('列表渲染与状态 pill', async ({ page, mockApi }) => {
    mockApi.registerUser()
    mockApi.setOrders([
      paidOrder(),
      paidOrder({ order_no: 'S-PENDING-1', status: 'pending', paid_at: '', remaining_pay_seconds: 372 }),
      paidOrder({ order_no: 'S-REFUNDED-1', status: 'refunded', refunded_at: '2026-08-31T02:00:00Z', refund_amount_fen: 776 }),
    ])
    await gotoOrders(page)
    await expect(page.getByText('PRO · 包季').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('已支付').first()).toBeVisible()
    await expect(page.getByText('等待支付').first()).toBeVisible()
    await expect(page.getByText('已退款').first()).toBeVisible()
    await expect(page.getByText('06:12')).toBeVisible() // 372s → 06:12
    await expect(page.getByText('¥72.00').first()).toBeVisible()
  })

  test('行点击进详情', async ({ page, mockApi }) => {
    mockApi.registerUser()
    mockApi.setOrders([paidOrder()])
    await gotoOrders(page)
    await page.getByText('S20260830143000ABC123').first().click()
    await expect(page).toHaveURL(/\/dashboard\/orders\/S20260830143000ABC123/)
  })

  test('列表尾退款口径说明', async ({ page, mockApi }) => {
    mockApi.registerUser()
    mockApi.setOrders([paidOrder()])
    await gotoOrders(page)
    await expect(page.getByText(/退款按剩余时长折算、原路退回/)).toBeVisible({ timeout: 10000 })
  })
})
