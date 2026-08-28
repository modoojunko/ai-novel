import { test, expect } from '../fixtures'

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('显示品牌标题和副标题', async ({ page }) => {
    await expect(page.getByText('人铸灵魂')).toBeVisible()
    await expect(page.getByText('AI 是笔，你才是作家')).toBeVisible()
  })

  test('显示下载按钮和查看套餐按钮', async ({ page }) => {
    await expect(page.getByRole('button', { name: '免费下载' })).toBeVisible()
    await expect(page.getByRole('link', { name: '查看套餐' })).toBeVisible()
  })

  test('免费下载打开弹窗（双平台直链）', async ({ page }) => {
    // #214 起下载走弹窗：打开后才渲染双平台安装包直链
    await page.getByRole('button', { name: '免费下载' }).click()
    await expect(page.locator('.mcard')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('link', { name: /下载 Windows/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /下载 macOS/ })).toBeVisible()
  })

  test('导航栏显示登录和注册链接（未登录）', async ({ page }) => {
    const loginBtn = page.locator('.mkt-nav a[href="/login"]').first()
    await expect(loginBtn).toBeVisible()
    const registerBtn = page.locator('.mkt-nav a[href="/register"]').first()
    await expect(registerBtn).toBeVisible()
  })

  test('导航栏显示「我的账号」（已登录）', async ({ page, mockApi }) => {
    mockApi.registerUser()
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/')
    await expect(page.locator('.mkt-nav a[href="/dashboard"]')).toBeVisible()
    await expect(page.locator('.mkt-nav a[href="/login"]')).not.toBeVisible()
    // 已登录 Hero：进入控制台与免费下载并存，登录后仍有下载入口
    await expect(page.getByRole('link', { name: '进入控制台' })).toBeVisible()
    await expect(page.getByRole('button', { name: '免费下载' })).toBeVisible()
  })

  test('功能区块存在六个工作流步骤', async ({ page }) => {
    await page.locator('#features').scrollIntoViewIfNeeded()
    const steps = ['建书', '设定', '大纲', '章纲', '写作', '归档']
    for (const step of steps) {
      await expect(page.getByText(step).first()).toBeVisible()
    }
  })

  test('套餐区块显示卡片', async ({ page }) => {
    await page.locator('#pricing').scrollIntoViewIfNeeded()
    const cards = page.locator('#pricing .mkt-plan')
    const count = await cards.count()
    expect(count).toBe(5)
  })

  test('激活指南区块三步流程', async ({ page }) => {
    await page.locator('#guide').scrollIntoViewIfNeeded()
    await expect(page.getByText('下载安装')).toBeVisible()
    await expect(page.getByText('注册账号')).toBeVisible()
    await expect(page.getByText('激活 License')).toBeVisible()
  })

  test('底部页脚包含链接和版权', async ({ page }) => {
    const footer = page.locator('footer')
    await expect(footer.getByText('爱小说 · AI Novel')).toBeVisible()
    await expect(footer.getByText('你的小说永远属于你')).toBeVisible()
  })

  test('锚点导航：点击查看套餐跳转到 pricing', async ({ page }) => {
    await page.getByRole('link', { name: '查看套餐' }).click()
    await expect(page.locator('#pricing')).toBeVisible()
  })

  test('「已有激活码」链接跳转登录页', async ({ page }) => {
    await page.getByRole('link', { name: /去控制台激活/ }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('桌面端 > lg 时导航菜单可见', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await expect(page.locator('.mkt-nav a[href="/#features"]')).toBeVisible()
    await expect(page.locator('.mkt-nav a[href="/#pricing"]')).toBeVisible()
  })

  test('Trial 卡「注册领取」按钮跳注册页', async ({ page }) => {
    await page.locator('#pricing').scrollIntoViewIfNeeded()
    const registerBtn = page.locator('#pricing a[href="/register"]').first()
    await expect(registerBtn).toBeVisible()
  })
})
