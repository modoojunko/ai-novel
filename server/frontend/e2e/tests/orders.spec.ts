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

/** tab 按钮（exact 防止「全部」误匹配「切回全部查看」） */
function tabButton(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true })
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

  test('默认待支付版：进页只显示等待支付订单', async ({ page, mockApi }) => {
    mockApi.registerUser()
    mockApi.setOrders([
      paidOrder(),
      paidOrder({ order_no: 'S-PENDING-1', status: 'pending', paid_at: '', remaining_pay_seconds: 372 }),
      paidOrder({ order_no: 'S-REFUNDED-1', status: 'refunded', refunded_at: '2026-08-31T02:00:00Z', refund_amount_fen: 776 }),
    ])
    await gotoOrders(page)
    await expect(tabButton(page, '待支付')).toHaveClass(/on/, { timeout: 10000 })
    await expect(page.getByText('等待支付').first()).toBeVisible()
    await expect(page.getByText('06:12')).toBeVisible() // 372s → 06:12
    // 其他版订单不可见
    await expect(page.getByText('已支付')).toHaveCount(0)
    await expect(page.getByText('已退款')).toHaveCount(0)
    await expect(page).toHaveURL(/\/dashboard\/orders$/) // 默认版不写 tab 参数
  })

  test('全部版渲染各状态行与倒计时', async ({ page, mockApi }) => {
    mockApi.registerUser()
    mockApi.setOrders([
      paidOrder(),
      paidOrder({ order_no: 'S-PENDING-1', status: 'pending', paid_at: '', remaining_pay_seconds: 372 }),
      paidOrder({ order_no: 'S-REFUNDED-1', status: 'refunded', refunded_at: '2026-08-31T02:00:00Z', refund_amount_fen: 776 }),
    ])
    await gotoOrders(page)
    await tabButton(page, '全部').click()
    await expect(page.getByText('¥72.00').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('已支付').first()).toBeVisible()
    await expect(page.getByText('等待支付').first()).toBeVisible()
    await expect(page.getByText('已退款').first()).toBeVisible()
    await expect(page.getByText('06:12')).toBeVisible()
  })

  test('切已完成版：过滤+URL 同步', async ({ page, mockApi }) => {
    mockApi.registerUser()
    mockApi.setOrders([
      paidOrder(),
      paidOrder({ order_no: 'S-PENDING-1', status: 'pending', paid_at: '' }),
    ])
    await gotoOrders(page)
    await tabButton(page, '已完成').click()
    await expect(page.getByText('S20260830143000ABC123')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('等待支付')).toHaveCount(0)
    await expect(page).toHaveURL(/tab=done/)
  })

  test('URL 刷新还原选中版', async ({ page, mockApi }) => {
    mockApi.registerUser()
    mockApi.setOrders([
      paidOrder(),
      paidOrder({ order_no: 'S-REFUNDED-1', status: 'refunded', refunded_at: '2026-08-31T02:00:00Z', refund_amount_fen: 776 }),
    ])
    await gotoOrders(page)
    await tabButton(page, '退款').click()
    await expect(page.getByText('已退款').first()).toBeVisible({ timeout: 10000 })
    await page.reload()
    await expect(tabButton(page, '退款')).toHaveClass(/on/, { timeout: 10000 })
    await expect(page.getByText('已退款').first()).toBeVisible()
    await expect(page.getByText('已支付')).toHaveCount(0)
  })

  test('某类空态：空文案+切回全部出口', async ({ page, mockApi }) => {
    mockApi.registerUser()
    mockApi.setOrders([paidOrder()]) // 无待支付单
    await gotoOrders(page)
    await expect(page.getByText('没有待支付的订单')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: '切回全部查看' }).click()
    await expect(tabButton(page, '全部')).toHaveClass(/on/)
    await expect(page.getByText('已支付').first()).toBeVisible()
  })

  test('加载更多：跨版追加去重，取完按钮消失', async ({ page, mockApi }) => {
    mockApi.registerUser()
    mockApi.setOrders(
      Array.from({ length: 45 }, (_, i) => paidOrder({
        order_no: `S-DONE-${String(i).padStart(3, '0')}`,
      })),
    )
    await gotoOrders(page)
    await expect(page.getByText('没有待支付的订单')).toBeVisible({ timeout: 10000 })
    await tabButton(page, '已完成').click()
    await expect(page.getByText('已显示 20 笔 · 共 45 笔')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: '加载更多' }).click()
    await expect(page.getByText('已显示 40 笔 · 共 45 笔')).toBeVisible()
    await page.getByRole('button', { name: '加载更多' }).click()
    await expect(page.getByText('已显示 45 笔 · 共 45 笔')).toBeVisible()
    await expect(page.getByRole('button', { name: '加载更多' })).toHaveCount(0)
    // 去重：45 行订单号唯一
    const nos = await page.locator('.order-row .order-sub .num').allTextContents()
    expect(nos.length).toBe(45)
    expect(new Set(nos).size).toBe(45)
  })

  test('行点击进详情', async ({ page, mockApi }) => {
    mockApi.registerUser()
    mockApi.setOrders([paidOrder({ order_no: 'S-PENDING-1', status: 'pending', paid_at: '' })])
    await gotoOrders(page)
    await page.getByText('S-PENDING-1').first().click()
    await expect(page).toHaveURL(/\/dashboard\/orders\/S-PENDING-1/)
  })

  test('切版等待期旧列表保留置灰，不白屏（orders-page-latency）', async ({ page, mockApi }) => {
    mockApi.registerUser()
    mockApi.setOrders([
      paidOrder({ order_no: 'S-PAID-1' }),
      paidOrder({ order_no: 'S-REFUND-1', status: 'refunded', refunded_at: '2026-08-31T02:00:00Z', refund_amount_fen: 776 }),
    ])
    await gotoOrders(page)
    await expect(page.getByText('没有待支付的订单')).toBeVisible({ timeout: 10000 })
    await tabButton(page, '全部').click()
    await expect(page.getByText('S-PAID-1')).toBeVisible({ timeout: 10000 }) // 先等全部版渲染完
    // 请求在途（mock 延迟 1.5s）：旧内容不被清空、面板置灰、尾块加载指示
    mockApi.setOrdersGate({ delayMs: 1500 })
    await tabButton(page, '退款').click()
    await expect(page.locator('.panel.refreshing')).toBeVisible()
    await expect(page.getByText('S-PAID-1')).toBeVisible() // 旧列表仍在
    await expect(page.getByText('加载中…').first()).toBeVisible()
    // 响应到达：整批替换为退款版
    mockApi.setOrdersGate(null)
    await expect(page.getByText('S-REFUND-1')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.panel.refreshing')).toHaveCount(0)
    await expect(page.getByText('S-PAID-1')).toHaveCount(0)
  })

  test('切版请求失败保留旧列表，不误报空态（orders-page-latency）', async ({ page, mockApi }) => {
    mockApi.registerUser()
    mockApi.setOrders([
      paidOrder({ order_no: 'S-PAID-1' }),
      paidOrder({ order_no: 'S-REFUND-1', status: 'refunded', refunded_at: '2026-08-31T02:00:00Z', refund_amount_fen: 776 }),
    ])
    await gotoOrders(page)
    await expect(page.getByText('没有待支付的订单')).toBeVisible({ timeout: 10000 })
    await tabButton(page, '全部').click()
    await expect(page.getByText('S-PAID-1').first()).toBeVisible({ timeout: 10000 })
    mockApi.setOrdersGate({ fail: true })
    await tabButton(page, '退款').click()
    // 失败后旧列表原样保留；不出现「没有退款的订单」误导空态
    await expect(page.getByText('S-PAID-1').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('没有退款的订单')).toHaveCount(0)
    mockApi.setOrdersGate(null)
    await tabButton(page, '退款').click()
    await expect(page.getByText('S-REFUND-1')).toBeVisible({ timeout: 10000 }) // 恢复后可重试成功
  })

  test('列表尾退款口径说明', async ({ page, mockApi }) => {
    mockApi.registerUser()
    mockApi.setOrders([paidOrder()])
    await gotoOrders(page)
    await expect(page.getByText(/退款按剩余时长折算、原路退回/)).toBeVisible({ timeout: 10000 })
  })
})
