import { test, expect } from '../fixtures'

test.describe('OAuth 设备授权页 (/auth)', () => {
  test('无 pc_hash 参数时显示警告', async ({ page }) => {
    await page.goto('/auth')
    await expect(page.getByText('无效的授权请求')).toBeVisible()
  })

  test('有效参数显示授权表单', async ({ page }) => {
    await page.goto('/auth?pc_hash=test_hash_123')
    await expect(page.getByText('设备授权').first()).toBeVisible()
    await expect(page.getByText('桌面应用请求绑定此设备')).toBeVisible()
  })

  test('成功授权显示成功视图', async ({ page, mockApi }) => {
    mockApi.registerUser()
    await page.goto('/auth?pc_hash=test_hash_123')
    const inputs = page.locator('input')
    await inputs.nth(0).fill('testuser')
    await inputs.nth(1).fill('Pass123!')
    await page.locator('button:has-text("授权登录")').click()
    await expect(page.getByText('授权成功')).toBeVisible()
    await expect(page.getByText('此页面可以关闭了')).toBeVisible()
  })

  test('提交空表单保持表单可见', async ({ page, mockApi }) => {
    mockApi.registerUser()
    await page.goto('/auth?pc_hash=test_hash_123')
    // 空表单时按钮应禁用，表单保持可见
    await expect(page.locator('button:has-text("授权登录")')).toBeDisabled()
    await expect(page.getByText('设备授权').first()).toBeVisible()
  })

  test('底部有注册链接', async ({ page }) => {
    await page.goto('/auth?pc_hash=test_hash_123')
    await expect(page.locator('a[href="/register"]').first()).toBeVisible()
  })
})
