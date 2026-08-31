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
    expect(count).toBe(4)
  })

  test('套餐卡展示与收银台同源的价格（/api/pay/skus）', async ({ page }) => {
    await page.locator('#pricing').scrollIntoViewIfNeeded()
    // 价格来自公开商品目录（mock 默认 PRO 三档：¥30 / ¥72 / ¥239.2）
    const prices = page.locator('#pricing .price')
    await expect(prices).toContainText(['¥0/7天', '¥30/月', '¥72/季', '¥239.2/年'])
    // 折扣徽标来自 discount_display，划线原价同卡展示
    await expect(page.getByText('9折')).toBeVisible()
    await expect(page.getByText('8折')).toBeVisible()
    await expect(page.getByText('¥80')).toBeVisible()
    await expect(page.getByText('¥299')).toBeVisible()
    // 「最受欢迎」跟随 popular_sku（年付），不再写死季付
    await expect(page.locator('#pricing .mkt-plan.pro h3')).toHaveText('年付')
    // 购买入口全部进自家收银台，淘宝死链清零
    await expect(page.locator('#pricing a[href*="taobao"]')).toHaveCount(0)
    expect(await page.locator('#pricing a[href="/pay"]').count()).toBe(3)
  })

  test('停售时隐藏价格但保留套餐骨架与收银台入口', async ({ page, mockApi }) => {
    mockApi.setSkus({ purchase_enabled: false, agreement_version: 'v2026.08', tiers: [], popular_sku: 'pro_yearly', skus: [
      { sku_key: 'pro_monthly', tier_key: 'pro', period: 'monthly', period_days: 30, base_price_fen: 3000, discount_display: '', price_fen: 3000, device_limit: 3 },
      { sku_key: 'pro_quarterly', tier_key: 'pro', period: 'quarterly', period_days: 90, base_price_fen: 8000, discount_display: '9折', price_fen: 7200, device_limit: 3 },
      { sku_key: 'pro_yearly', tier_key: 'pro', period: 'yearly', period_days: 365, base_price_fen: 29900, discount_display: '8折', price_fen: 23920, device_limit: 5 },
    ] })
    await page.goto('/')
    await page.locator('#pricing').scrollIntoViewIfNeeded()
    await expect(page.locator('#pricing .mkt-plan')).toHaveCount(4)
    // 付费卡价格留白，只留"价格见收银台"；试用卡 ¥0 不受影响
    await expect(page.getByText('价格见收银台')).toHaveCount(3)
    await expect(page.locator('#pricing').getByText('¥30')).toHaveCount(0)
    await expect(page.locator('#pricing').getByText('¥72')).toHaveCount(0)
    await expect(page.locator('#pricing a[href="/pay"]').first()).toBeVisible()
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
