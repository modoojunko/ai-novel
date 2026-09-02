import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import type { MockApi } from '../mocks/api-handlers'

function fulfilledOrder(): Parameters<MockApi['setOrders']>[0][number] {
  return {
    order_no: 'S20260830143000ABC123',
    status: 'fulfilled',
    amount_fen: 2400,
    snapshot: { tier_display: 'PRO', period: 'monthly', period_days: 30 },
    created_at: '2026-08-22T10:22:00Z',
    paid_at: '2026-08-22T10:24:00Z',
    refunded_at: '',
    refund_amount_fen: null,
  }
}

async function gotoRefund(page: Page, orderNo = 'S20260830143000ABC123'): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('token', 'e2e-token'))
  await page.goto(`/dashboard/orders/${orderNo}/refund`)
}

test.describe('退款流', () => {
  test.beforeEach(async ({ mockApi }) => {
    mockApi.registerUser()
  })

  test('态一 preview：折算金额展示', async ({ page, mockApi }) => {
    mockApi.setOrders([fulfilledOrder()])
    await gotoRefund(page)
    await expect(page.getByRole('heading', { name: '申请退款' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('¥7.76')).toBeVisible()
    await expect(page.getByText('预计退款（原路退回）')).toBeVisible()
    await expect(page.getByText(/按剩余时长计算退款，精确到秒/)).toBeVisible()
    await expect(page.getByRole('button', { name: '确认退款金额，继续' })).toBeVisible()
    await expect(page.getByText('先不退了')).toBeVisible()
    // 全文尾链直达退款政策文档（而非客服页），新标签不丢当前页状态
    await expect(page.locator('a[href="/legal/refund-policy.html"][target="_blank"]')).toBeVisible()
  })

  test('态二 confirm → 态三 processing', async ({ page, mockApi }) => {
    mockApi.setOrders([fulfilledOrder()])
    await gotoRefund(page)
    await page.getByRole('button', { name: '确认退款金额，继续' }).click()
    const modal = page.getByRole('dialog', { name: '确认退款' })
    await expect(modal).toBeVisible({ timeout: 10000 })
    await expect(modal.getByText('¥7.76')).toBeVisible()
    // 「再想想」先关一次验证可取消
    await modal.getByRole('button', { name: '再想想' }).click()
    await expect(modal).toHaveCount(0)
    // 再开并确认
    await page.getByRole('button', { name: '确认退款金额，继续' }).click()
    await page.getByRole('dialog', { name: '确认退款' }).getByRole('button', { name: '确认退款' }).click()
    await expect(page.getByRole('heading', { name: '退款处理中' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/已受理，正在退回 ¥7\.76/)).toBeVisible()
    await expect(page.getByText('已停止')).toBeVisible() // 冻结式口径：无「恢复使用」文案
  })

  test('拒绝态：不足 1 分', async ({ page, mockApi }) => {
    mockApi.setOrders([fulfilledOrder()])
    mockApi.setRefundPreview({ refundable: false, reason: 'below_one_fen' })
    await gotoRefund(page)
    await expect(page.getByText(/不足 1 分钱，无法发起退款/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('订单即将到期，剩余时长可直接用完')).toBeVisible()
  })

  test('拒绝态：超 1 年窗', async ({ page, mockApi }) => {
    mockApi.setOrders([fulfilledOrder()])
    mockApi.setRefundPreview({ refundable: false, reason: 'over_one_year' })
    await gotoRefund(page)
    await expect(page.getByText(/超出微信退款通道的受理窗口/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: '联系客服' })).toBeVisible()
  })

  test('态四 refunded：已原路退回', async ({ page, mockApi }) => {
    mockApi.setOrders([fulfilledOrder()].map((o) => ({
      ...o, status: 'refunded', refunded_at: '2026-08-22T11:02:00Z', refund_amount_fen: 776,
    })))
    await gotoRefund(page)
    await expect(page.getByRole('heading', { name: '退款完成' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('¥7.76 已原路退回')).toBeVisible()
    await expect(page.getByText(/不受影响，按原起止继续/)).toBeVisible()
    await expect(page.getByRole('button', { name: '返回我的订单' })).toBeVisible()
  })

  test('processing 订单再次进入退款页 → 直接给处理中视图', async ({ page, mockApi }) => {
    mockApi.setOrders([fulfilledOrder()].map((o) => ({ ...o, status: 'refund_processing', refund_amount_fen: 776 })))
    await gotoRefund(page)
    await expect(page.getByRole('heading', { name: '退款处理中' })).toBeVisible({ timeout: 10000 })
  })
})
