import path from 'node:path'

import { test, expect } from '../fixtures'

/**
 * 账号自助注销（account-deletion，tasks 4.1/4.2）。
 * 覆盖：危险区入口、无权益直达、有权益阻塞（放弃勾选）、导出备份必勾声明、
 * 受理态、撤销期登录视图、撤销恢复、已注销终态。
 */
// 4.3 实现截图对照：落 change evidence（S端无 parity 门禁，截图即一致性证据）
const SHOT_DIR = path.resolve(process.cwd(), '../../openspec/changes/account-deletion/evidence/screens')
const shot = (page: import('@playwright/test').Page, name: string) =>
  page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true })

test.describe('账号自助注销', () => {
  test.beforeEach(async ({ page, mockApi }) => {
    mockApi.registerUser()
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/dashboard/account')
    await expect(page.getByRole('heading', { name: '账户设置' })).toBeVisible({ timeout: 15000 })
  })

  test('危险区入口（安静不诱导：页面尾部、描边按钮）', async ({ page }) => {
    await expect(page.getByText('危险区')).toBeVisible()
    const btn = page.getByRole('button', { name: '注销账号…' })
    await expect(btn).toBeVisible()
    await shot(page, '01-account-danger-zone')
  })

  test('无未消耗权益：直达密码步，导出备份必勾后受理', async ({ page, mockApi }) => {
    mockApi.setAssetsBlocking(false)
    await page.reload()
    await expect(page.getByRole('heading', { name: '账户设置' })).toBeVisible()

    await page.getByRole('button', { name: '注销账号…' }).click()
    // 无权益 → 跳过后果后的权益处置步，直达密码步；导出备份未勾选时提交禁用
    await expect(page.getByText('我已将小说文档')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: '确认申请注销' })).toBeDisabled()

    await shot(page, '03-wizard-password-confirm')
    await page.getByText('我已将小说文档').click()
    await page.locator('input[type="password"]').last().fill('Pass123!')
    await page.getByRole('button', { name: '确认申请注销' }).click()

    // 受理态：15 天撤销期 + 到期日预告
    await expect(page.getByText('注销申请已提交').first()).toBeVisible()
    await shot(page, '04-wizard-submitted')
    await page.getByRole('button', { name: '知道了' }).click()

    // 撤销期状态行（响度随任务：warn）
    await expect(page.getByText(/你的账号已申请注销/).first()).toBeVisible()
  })

  test('有未消耗权益：逐项申请退款后方可继续（或放弃）', async ({ page, mockApi }) => {
    mockApi.setAssetsBlocking(true)
    await page.reload()
    await expect(page.getByRole('heading', { name: '账户设置' })).toBeVisible()

    await page.getByRole('button', { name: '注销账号…' }).click()
    await expect(page.getByText('永久注销本账号')).toBeVisible()
    await page.waitForTimeout(400) // 等弹层进场动画完成，避免截到半透明中间态
    await shot(page, '01b-wizard-consequences')
    await page.getByRole('button', { name: '我已了解，继续' }).click()

    // 权益处置步：未申请退款的权益 → 行内 [申请退款]；未处置完「放弃并继续」禁用
    await expect(page.getByText('未消耗的套餐权益', { exact: false }).first()).toBeVisible()
    await shot(page, '02-wizard-assets')
    await expect(page.getByRole('button', { name: '放弃并继续' })).toBeDisabled()

    // 逐项申请退款：按钮消失 → 行内出现「退款处理中」→ 全部处置完可继续
    await page.getByRole('button', { name: '申请退款' }).click()
    await expect(page.getByText('退款处理中')).toBeVisible()
    await expect(page.getByRole('button', { name: '放弃并继续' })).toBeEnabled()
    await page.getByRole('button', { name: '放弃并继续' }).click()

    await page.getByText('我已将小说文档').click()
    await page.locator('input[type="password"]').last().fill('Pass123!')
    await page.getByRole('button', { name: '确认申请注销' }).click()
    await expect(page.getByText('注销申请已提交').first()).toBeVisible()
    await shot(page, '04-wizard-submitted')
  })

  test('撤销期登录：状态视图 + 撤销恢复', async ({ page, mockApi }) => {
    mockApi.setLoggedIn()
    mockApi.setDeletionPending(true)
    await page.evaluate(() => localStorage.removeItem('token'))
    await page.goto('/login')
    await page.getByLabel('用户名').fill(mockApi.username)
    await page.locator('input[type="password"]').fill('Pass123!')
    await page.getByRole('button', { name: '登录' }).click()

    // 撤销期视图：状态 + 撤销出口（US-5.2）
    await expect(page.getByText(/你的账号已申请注销/)).toBeVisible()
    await shot(page, '06-login-pending')
    await expect(page.getByText(/剩/).first()).toBeVisible()

    await page.getByRole('button', { name: '撤销注销，恢复账号' }).click()
    // mock：撤销成功 → 自动重登录 → 进入控制台（账号恢复正常）
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
  })

  test('已注销终态：明确结果与出路（US-6.2）', async ({ page, mockApi }) => {
    mockApi.setLoggedIn()
    mockApi.setAccountDeleted()
    await page.evaluate(() => localStorage.removeItem('token'))
    await page.goto('/login')
    await page.getByLabel('用户名').fill(mockApi.username)
    await page.locator('input[type="password"]').fill('Pass123!')
    await page.getByRole('button', { name: '登录' }).click()

    await expect(page.getByText('该账号已注销')).toBeVisible()
    await expect(page.getByText('你设备上的作品仍完好保留')).toBeVisible()
    await shot(page, '07-login-deleted')
    await expect(page.getByRole('link', { name: '注册新账号' })).toBeVisible()
  })
})
