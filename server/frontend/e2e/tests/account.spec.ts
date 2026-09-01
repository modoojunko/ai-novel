import { test, expect } from '../fixtures'

test.describe('账户设置页', () => {
  test.beforeEach(async ({ page, mockApi }) => {
    mockApi.registerUser()
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/dashboard/account')
  })

  test('页面标题与账号信息卡', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard\/account/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: '账户设置' })).toBeVisible()
    // account-blocks-unify：账号信息卡=只读 kv（用户名/注册时间 + 账号模型提示）
    const info = page.locator('.panel:has-text("账号信息")')
    await expect(info.locator('.kv')).toContainText('注册时间')
    await expect(info.locator('.kv')).toContainText('2026-08-15')
    await expect(info).toContainText('忘记密码可在登录页')
    // 套餐状态不进本页（IA D1）
    await expect(info).not.toContainText('到期')
  })

  test('安全块默认零裸表单——编辑入口为展示行按钮', async ({ page }) => {
    // 页面本体无任何输入框（行+弹层口径的核心断言）
    await expect(page.locator('.page-col .panel input')).toHaveCount(0)
    await expect(page.locator('.page-col .panel select')).toHaveCount(0)
    const security = page.locator('.panel:has-text("安全")').first()
    await expect(security.locator('.set-row:has-text("修改密码") button')).toHaveText('修改密码')
    // mock 用户已带密保 → 行状态显示问题文本，按钮为修改密保
    await expect(security.locator('.set-row:has-text("密保设置") .d')).toHaveText('已设置：你的宠物名字是？')
    await expect(security.locator('.set-row:has-text("密保设置") button')).toHaveText('修改密保')
    await expect(security.locator('.set-row:has-text("退出登录")')).toBeVisible()
  })

  test('成功修改密码（弹层路径）', async ({ page }) => {
    await page.locator('.set-row:has-text("修改密码") button').click()
    const dlg = page.locator('.mcard:has-text("修改密码")')
    await dlg.locator('input').nth(0).fill('Pass123!')
    await dlg.locator('input').nth(1).fill('NewPass456!')
    await dlg.locator('input').nth(2).fill('NewPass456!')
    await dlg.locator('button:has-text("确认修改")').click()
    await expect(page.getByText('密码已修改').first()).toBeVisible()
    // 成功后弹层关闭，页面回到展示行
    await expect(dlg).toBeHidden()
    await expect(page.locator('.page-col .panel input')).toHaveCount(0)
  })

  test('新密码校验 - 不足6位（弹层内报错不关闭）', async ({ page }) => {
    await page.locator('.set-row:has-text("修改密码") button').click()
    const dlg = page.locator('.mcard:has-text("修改密码")')
    await dlg.locator('input').nth(1).fill('123')
    await expect(dlg.getByText('密码至少 6 位')).toBeVisible()
  })

  test('确认密码不一致（弹层内）', async ({ page }) => {
    await page.locator('.set-row:has-text("修改密码") button').click()
    const dlg = page.locator('.mcard:has-text("修改密码")')
    await dlg.locator('input').nth(1).fill('NewPass456!')
    await dlg.locator('input').nth(2).fill('Wrong!')
    await expect(dlg.getByText('两次密码不一致').first()).toBeVisible()
  })

  test('新旧密码相同提示（弹层内）', async ({ page }) => {
    await page.locator('.set-row:has-text("修改密码") button').click()
    const dlg = page.locator('.mcard:has-text("修改密码")')
    await dlg.locator('input').nth(0).fill('Same123!')
    await dlg.locator('input').nth(1).fill('Same123!')
    await dlg.locator('input').nth(2).fill('Same123!')
    await expect(dlg.getByText('新密码不能与旧密码相同')).toBeVisible()
  })

  test('密保弹层保存后行状态即时更新', async ({ page }) => {
    await page.locator('.set-row:has-text("密保设置") button').click()
    const dlg = page.locator('.mcard:has-text("密保设置")')
    // 打开时预选当前问题
    await expect(dlg.locator('select')).toHaveValue('你的宠物名字是？')
    // 旧答案不回显（答案输入框永远为空）
    await expect(dlg.locator('input').first()).toHaveValue('')
    await dlg.locator('select').selectOption('你的出生城市是？')
    await dlg.locator('input').first().fill('Shanghai')
    await dlg.locator('button:has-text("保存")').click()
    await expect(page.getByText('密保已更新').first()).toBeVisible()
    const security = page.locator('.panel:has-text("安全")').first()
    await expect(security.locator('.set-row:has-text("密保设置") .d')).toHaveText('已设置：你的出生城市是？')
  })

  test('密保弹层自定义问题', async ({ page }) => {
    await page.locator('.set-row:has-text("密保设置") button').click()
    const dlg = page.locator('.mcard:has-text("密保设置")')
    await dlg.locator('select').selectOption('__custom__')
    await expect(dlg.getByPlaceholder('输入你的密保问题')).toBeVisible()
  })

  test('密保弹层未填答案时保存禁用', async ({ page }) => {
    await page.locator('.set-row:has-text("密保设置") button').click()
    const dlg = page.locator('.mcard:has-text("密保设置")')
    await expect(dlg.locator('button:has-text("保存")')).toBeDisabled()
  })

  test('未设置密保时行提示与设置密保按钮', async ({ page, mockApi }) => {
    mockApi.registerUser({ security_question: '' })
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/dashboard/account')
    const security = page.locator('.panel:has-text("安全")').first()
    await expect(security.locator('.set-row:has-text("密保设置") .d')).toContainText('未设置')
    await expect(security.locator('.set-row:has-text("密保设置") button')).toHaveText('设置密保')
  })
})
