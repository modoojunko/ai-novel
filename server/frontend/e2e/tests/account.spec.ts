import { test, expect } from '../fixtures'

test.describe('账户设置页', () => {
  test.beforeEach(async ({ page, mockApi }) => {
    mockApi.registerUser()
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/dashboard/account')
  })

  test('页面标题', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard\/account/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: '账户设置' })).toBeVisible()
  })

  test('成功修改密码', async ({ page }) => {
    const pwCard = page.locator('.panel:has-text("修改密码")')
    await pwCard.locator('input').nth(0).fill('Pass123!')
    await pwCard.locator('input').nth(1).fill('NewPass456!')
    await pwCard.locator('input').nth(2).fill('NewPass456!')
    await pwCard.locator('button:has-text("保存")').click()
    await expect(page.getByText('密码已修改').first()).toBeVisible()
  })

  test('新密码校验 - 不足6位', async ({ page }) => {
    const pwCard = page.locator('.panel:has-text("修改密码")')
    await pwCard.locator('input').nth(1).fill('123')
    await expect(page.getByText('密码至少 6 位')).toBeVisible()
  })

  test('确认密码不一致', async ({ page }) => {
    const pwCard = page.locator('.panel:has-text("修改密码")')
    await pwCard.locator('input').nth(1).fill('NewPass456!')
    await pwCard.locator('input').nth(2).fill('Wrong!')
    await expect(page.getByText('两次密码不一致').first()).toBeVisible()
  })

  test('新旧密码相同提示', async ({ page }) => {
    const pwCard = page.locator('.panel:has-text("修改密码")')
    await pwCard.locator('input').nth(0).fill('Same123!')
    await pwCard.locator('input').nth(1).fill('Same123!')
    await pwCard.locator('input').nth(2).fill('Same123!')
    await expect(page.getByText('新密码不能与旧密码相同')).toBeVisible()
  })

  test('密保设置可保存', async ({ page }) => {
    const secCard = page.locator('.panel:has-text("密保设置")')
    await secCard.locator('select').first().selectOption('你的出生城市是？')
    await secCard.locator('input').fill('Shanghai')
    await secCard.locator('button:has-text("保存")').click()
    await expect(page.getByText('密保设置成功').first()).toBeVisible()
  })

  test('密保自定义问题', async ({ page }) => {
    const secCard = page.locator('.panel:has-text("密保设置")')
    await secCard.locator('select').first().selectOption('__custom__')
    await expect(page.getByPlaceholder('输入你的密保问题')).toBeVisible()
  })

  test('密保按钮未填禁用', async ({ page }) => {
    const secCard = page.locator('.panel:has-text("密保设置")')
    await expect(secCard.locator('button:has-text("保存")')).toBeDisabled()
  })
})
