import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import type { MockApi } from '../mocks/api-handlers'

function order(overrides: Partial<Parameters<MockApi['setOrders']>[0][number]> = {}): Parameters<MockApi['setOrders']>[0][number] {
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

async function gotoDetail(page: Page, orderNo = 'S20260830143000ABC123'): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('token', 'e2e-token'))
  await page.goto(`/dashboard/orders/${orderNo}`)
}

test.describe('订单详情六态', () => {
  test.beforeEach(async ({ mockApi }) => {
    mockApi.registerUser()
  })

  test('paid 态：申请退款 + 去我的套餐', async ({ page, mockApi }) => {
    mockApi.setOrders([order()])
    await gotoDetail(page)
    await expect(page.getByText('订单信息')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('已支付')).toBeVisible()
    await expect(page.getByRole('button', { name: '申请退款' })).toBeVisible()
    await expect(page.getByRole('button', { name: '去我的套餐' })).toBeVisible()
    // 协议留痕
    await expect(page.getByText(/已同意/)).toBeVisible()
  })

  test('paid 态申请退款跳退款页', async ({ page, mockApi }) => {
    mockApi.setOrders([order()])
    await gotoDetail(page)
    await page.getByRole('button', { name: '申请退款' }).click()
    await expect(page).toHaveURL(/\/refund$/)
  })

  test('waiting 态：继续支付 + 取消订单', async ({ page, mockApi }) => {
    mockApi.setOrders([order({ status: 'pending', paid_at: '', remaining_pay_seconds: 372 })])
    await gotoDetail(page)
    await expect(page.getByText('等待支付').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: '继续支付' })).toBeVisible()
    await expect(page.getByRole('button', { name: '取消订单' })).toBeVisible()
    // waiting 态不展示微信单号与协议
    await expect(page.getByText(/微信支付单号/)).toHaveCount(0)
  })

  test('waiting 态取消订单转已过期', async ({ page, mockApi }) => {
    mockApi.setOrders([order({ status: 'pending', paid_at: '', remaining_pay_seconds: 372 })])
    await gotoDetail(page)
    await page.getByRole('button', { name: '取消订单' }).click()
    await expect(page.getByText('已过期')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: '重新下单' })).toBeVisible()
  })

  test('refund_pending 态：冷静期倒计时 + 取消退款', async ({ page, mockApi }) => {
    mockApi.setOrders([order({ status: 'refund_pending', refund_amount_fen: 776 })])
    await gotoDetail(page)
    await expect(page.getByText(/退款将在 \d+ 分 \d+ 秒后提交/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: '取消退款' })).toBeVisible()
    await page.getByRole('button', { name: '取消退款' }).click()
    await expect(page.getByRole('button', { name: '申请退款' })).toBeVisible({ timeout: 10000 })
  })

  test('refunded 态：再来一单', async ({ page, mockApi }) => {
    mockApi.setOrders([order({ status: 'refunded', refunded_at: '2026-08-31T02:00:00Z', refund_amount_fen: 776 })])
    await gotoDetail(page)
    await expect(page.getByText('已退款')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: '再来一单' })).toBeVisible()
  })

  test('exception 态：核对中 + 联系客服', async ({ page, mockApi }) => {
    mockApi.setOrders([order({ status: 'exception' })])
    await gotoDetail(page)
    await expect(page.getByText('核对中')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/请勿重复支付/)).toBeVisible()
    await expect(page.getByRole('button', { name: '联系客服' })).toBeVisible()
  })

  test('微信支付单号脱敏 + 复制', async ({ page, mockApi }) => {
    mockApi.setOrders([order()])
    await gotoDetail(page)
    await expect(page.getByText(/4200\*\*\*\*C123/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: '复制完整单号' })).toBeVisible()
  })
})

test.describe('订单流程时间线（s-pay-post-purchase-completion）', () => {
  test.beforeEach(async ({ mockApi }) => {
    mockApi.registerUser()
  })

  test('已退款单到货时间可见且非 —（09-02 线上回归）', async ({ page, mockApi }) => {
    mockApi.setOrders([order({
      status: 'refunded',
      refunded_at: '2026-08-31T02:00:00Z',
      refund_requested_at: '2026-08-30T06:54:00Z',
      refund_amount_fen: 776,
    })])
    await gotoDetail(page)
    await expect(page.getByText('套餐到货（已收回）')).toBeVisible({ timeout: 10000 })
    const row = page.locator('.tl-row', { hasText: '套餐到货' })
    await expect(row.locator('.when')).toContainText('2026-08-30')
    // 申请退款环节留痕 + 退款完成行并存
    await expect(page.getByText('申请退款', { exact: true })).toBeVisible()
    await expect(page.getByText('退款完成（原路退回）')).toBeVisible()
  })

  test('待激活单到货行标注', async ({ page, mockApi }) => {
    mockApi.setOrders([order()])
    await gotoDetail(page)
    await expect(page.getByText('套餐到货（待激活，未计时）')).toBeVisible({ timeout: 10000 })
  })

  test('已激活单到货行显示剩余天数', async ({ page, mockApi }) => {
    mockApi.setOrders([order({
      grant: { status: 'active', activated_at: '2026-08-30T06:30:00', expires_at: '2026-11-28T00:00:00' },
    })])
    await gotoDetail(page)
    await expect(page.getByText(/套餐到货（已激活，计时中）· 剩余 \d+ 天/)).toBeVisible({ timeout: 10000 })
  })

  test('半截发货态不以支付时间冒充到货', async ({ page, mockApi }) => {
    mockApi.setOrders([order({ status: 'paid', fulfilled_at: '' })])
    await gotoDetail(page)
    const row = page.locator('.tl-row', { hasText: '套餐到货' })
    await expect(row).toBeVisible({ timeout: 10000 })
    await expect(row.locator('.when')).toContainText('预计')
    await expect(row.locator('.when')).not.toContainText('2026-')
  })
})
