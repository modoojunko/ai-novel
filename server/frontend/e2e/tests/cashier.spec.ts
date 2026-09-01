import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import type { MockApi } from '../mocks/api-handlers'

async function gotoPay(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('token', 'e2e-token'))
  await page.goto('/pay')
}

/** 选卡 → 去支付 → 协议弹窗打钩 → 确认，进入 waiting */
async function enterWaiting(page: Page): Promise<void> {
  await page.getByText('包年').first().click()
  await page.getByRole('button', { name: '去支付' }).click()
  const modal = page.locator('.mcard')
  await expect(modal).toBeVisible({ timeout: 10000 })
  // 未打钩时确认按钮禁用（协议留痕硬约束）
  await expect(modal.getByRole('button', { name: '阅读并同意，去支付' })).toBeDisabled()
  await modal.locator('input[type="checkbox"]').check()
  await modal.getByRole('button', { name: '阅读并同意，去支付' }).click()
  await expect(page.getByText('微信扫码支付')).toBeVisible({ timeout: 10000 })
}

test.describe('收银台', () => {
  test.beforeEach(async ({ mockApi }) => {
    mockApi.registerUser()
  })

  test('选套餐卡 → 协议弹窗 → 二维码等待态', async ({ page, mockApi }) => {
    mockApi.setPayHint('NOTPAY')
    await gotoPay(page)
    // 默认选中最受欢迎（包年）
    await expect(page.getByText('已选')).toBeVisible({ timeout: 10000 })
    await enterWaiting(page)
    await expect(page.getByText(/SE2ENEWORDER0001/)).toBeVisible()
    await expect(page.getByText(/二维码有效期剩/)).toBeVisible()
    // 二维码本地 canvas 渲染（aria-label 定位；code_url 不外发第三方服务）
    await expect(page.getByLabel('微信支付二维码')).toBeVisible()
  })

  test('支付成功 → 已到货待激活', async ({ page, mockApi }) => {
    mockApi.setPayHint('SUCCESS')
    await gotoPay(page)
    await enterWaiting(page)
    // 轮询（3s）或手动查单命中 → success；直接点手动查单加速
    await page.getByText('我已支付，帮我查一下到账').click()
    await expect(page.getByText('支付成功')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('已到货，待激活')).toBeVisible()
    await expect(page.getByRole('button', { name: '立即激活' })).toBeVisible()
  })

  test('手动查单未支付成功 → 反馈可重试', async ({ page, mockApi }) => {
    mockApi.setPayHint('PAYERROR')
    await gotoPay(page)
    await enterWaiting(page)
    await page.getByText('我已支付，帮我查一下到账').click()
    await expect(page.getByText(/本次支付未成功/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/二维码仍然有效/)).toBeVisible()
    await page.getByRole('button', { name: '返回重试' }).click()
    await expect(page.getByText('微信扫码支付')).toBeVisible()
  })

  test('取消支付返回选卡', async ({ page, mockApi }) => {
    mockApi.setPayHint('NOTPAY')
    await gotoPay(page)
    await enterWaiting(page)
    await page.getByRole('button', { name: '取消支付' }).click()
    await expect(page.getByText('升级套餐，解锁全部写作能力')).toBeVisible({ timeout: 10000 })
  })

  test('下单失败 → failCreate 可重试', async ({ page, mockApi }) => {
    mockApi.failCreateOrder(1)
    await gotoPay(page)
    await page.getByRole('button', { name: '去支付' }).click()
    const modal = page.locator('.mcard')
    await modal.locator('input[type="checkbox"]').check()
    await modal.getByRole('button', { name: '阅读并同意，去支付' }).click()
    await expect(page.getByText('订单创建失败')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/没有产生扣款/)).toBeVisible()
    await page.getByRole('button', { name: '重试' }).click()
    // 重试回选卡态，再走一遍成功
    await page.getByRole('button', { name: '去支付' }).click()
    await page.locator('.mcard input[type="checkbox"]').check()
    await page.locator('.mcard').getByRole('button', { name: '阅读并同意，去支付' }).click()
    await expect(page.getByText('微信扫码支付')).toBeVisible({ timeout: 10000 })
  })

  test('切换选择重置协议勾选', async ({ page }) => {
    await gotoPay(page)
    await page.getByText('包月').first().click()
    await page.getByRole('button', { name: '去支付' }).click()
    await page.locator('.mcard input[type="checkbox"]').check()
    await page.locator('.mcard').getByRole('button', { name: '再想想' }).click()
    // 换卡后 must 重打钩（goPay 重置 termsRead）
    await page.getByText('包季').first().click()
    await page.getByRole('button', { name: '去支付' }).click()
    await expect(page.locator('.mcard input[type="checkbox"]')).not.toBeChecked()
  })

  test('购买开关关闭 → 登录卡', async ({ page, mockApi }) => {
    mockApi.setPurchaseEnabled(false)
    await gotoPay(page)
    await expect(page.getByText('登录后继续购买')).toBeVisible({ timeout: 10000 })
  })
})
