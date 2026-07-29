import { test, expect } from '../fixtures'

test.describe('设备管理页', () => {
  test.beforeEach(async ({ page, mockApi }) => {
    mockApi.registerUser()
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/dashboard/devices')
  })

  test('页面标题', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard\/devices/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: '我的设备' })).toBeVisible()
  })

  test('状态摘要条', async ({ page }) => {
    await expect(page.getByText(/已激活/).first()).toBeVisible()
    await expect(page.getByText(/共绑定/).first()).toBeVisible()
  })

  test('设备列表有卡片', async ({ page }) => {
    // 验证设备 hostname 出现在页面上（来自 mock 数据）
    await expect(page.getByText('DESKTOP').first()).toBeVisible()
  })

  test('当前设备徽章', async ({ page }) => {
    await expect(page.getByText('当前设备').first()).toBeVisible()
  })

  test('移除设备弹窗', async ({ page }) => {
    // 找到非禁用的"移除"按钮（第 2 台设备的移除按钮）
    const removeBtn = page.getByRole('button', { name: '移除' }).and(page.locator(':not([disabled])'))
    await removeBtn.first().click()
    await expect(page.getByText('确认移除设备')).toBeVisible()
  })

  test('确认移除', async ({ page }) => {
    const removeBtn = page.getByRole('button', { name: '移除' }).and(page.locator(':not([disabled])'))
    await removeBtn.first().click()
    await page.getByRole('button', { name: '确认移除' }).click()
    await expect(page.getByRole('heading', { name: '我的设备' })).toBeVisible()
  })

  test('取消移除', async ({ page }) => {
    const removeBtn = page.getByRole('button', { name: '移除' }).and(page.locator(':not([disabled])'))
    await removeBtn.first().click()
    await page.getByRole('button', { name: '取消' }).click()
    await expect(page.getByText('确认移除设备')).not.toBeVisible()
  })
})
