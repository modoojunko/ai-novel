import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import type { MockApi } from '../mocks/api-handlers'

function cooldownOrder(): Parameters<MockApi['setOrders']>[0][number] {
  return {
    order_no: 'SCOOLDOWN0001',
    status: 'refund_pending',
    amount_fen: 2400,
    snapshot: { tier_display: 'PRO', period: 'monthly', period_days: 30 },
    created_at: '2026-08-30T06:22:00Z',
    paid_at: '2026-08-30T06:24:00Z',
    refunded_at: '',
    refund_amount_fen: 776,
  }
}

async function gotoDetail(page: Page, orderNo: string): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('token', 'e2e-token'))
  await page.goto(`/dashboard/orders/${orderNo}`)
}

test.describe('冷静期取消 vs 到点提交竞态', () => {
  test.beforeEach(async ({ mockApi }) => {
    mockApi.registerUser()
  })

  test('冷静期内取消 → CAS 赢 → 恢复使用（可再申请退款）', async ({ page, mockApi }) => {
    mockApi.setOrders([cooldownOrder()])
    await gotoDetail(page, 'SCOOLDOWN0001')
    await expect(page.getByRole('button', { name: '取消退款' })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: '取消退款' }).click()
    // mock 状态机：refund_pending → fulfilled（CAS 赢）
    await expect(page.getByRole('button', { name: '申请退款' })).toBeVisible({ timeout: 10000 })
    // 详情说明条回到已到货口径
    await expect(page.getByText(/套餐已到货/)).toBeVisible()
  })

  test('到点已提交（CAS 输）→ 提示已被受理且不可撤', async ({ page, mockApi }) => {
    mockApi.setOrders([cooldownOrder()])
    // 竞态注入：后端 CAS 输 = cancel 返回业务失败（已被到点提交）
    await page.route('**/api/pay/orders/SCOOLDOWN0001/refund/cancel', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 4009, msg: '冷静期已结束，退款已提交' }) }),
    )
    await gotoDetail(page, 'SCOOLDOWN0001')
    await page.getByRole('button', { name: '取消退款' }).click()
    // 前端不谎报成功：显示后端错误，且不回到 fulfilled 的「申请退款」态
    // （订单仍为退款流程态，待下轮刷新与后端收敛）
    await expect(page.getByText(/冷静期已结束/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: '申请退款' })).toHaveCount(0)
  })
})
