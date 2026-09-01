import { test, expect } from '../fixtures'

// 客服页 /support（contact-support-page）：免登录可访 + 核心内容 + 落地页页脚入口。
// 时限/邮箱口径断言与 constants/support.ts、docs/legal 四件套一致，改口径须同批改这里。
const EMAIL = 'support@xingweitouzi.cn'
const TOPIC_TITLES = ['退款与订单问题', '发票申请', '注销账号', '账号安全', '个人信息权利', '一般使用问题']

test.describe('客服页', () => {
  test('未登录直访：渲染核心内容，不重定向', async ({ page }) => {
    await page.goto('/support')
    await expect(page).toHaveURL(/\/support$/)
    await expect(page.getByRole('heading', { name: '联系客服' })).toBeVisible()
    await expect(page.getByText(EMAIL).first()).toBeVisible()
    // 主按钮 mailto 直链（无 target：同窗口交由邮件客户端接管）
    const mailBtn = page.locator(`a.btn[href="mailto:${EMAIL}"]`)
    await expect(mailBtn).toBeVisible()
    await expect(mailBtn).not.toHaveAttribute('target')
    // 六场景卡齐全 + 时限口径句
    for (const t of TOPIC_TITLES) {
      await expect(page.getByRole('heading', { name: t })).toBeVisible()
    }
    await expect(page.locator('.notice.info')).toContainText('48 小时')
    await expect(page.locator('.notice.info')).toContainText('15 个工作日')
  })

  test('场景卡「就此写邮件」预填主题', async ({ page }) => {
    await page.goto('/support')
    const lnk = page.locator('a.lnk', { hasText: '就此写邮件' }).first()
    const href = await lnk.getAttribute('href')
    expect(href).toMatch(new RegExp(`^mailto:${EMAIL.replace('.', '\\.')}\\?subject=`))
    expect(decodeURIComponent(href!.split('subject=')[1])).toContain('爱小说·')
  })

  test('落地页页脚入口：站内导航到客服页', async ({ page }) => {
    await page.goto('/')
    await page.locator('.mkt-foot-in a', { hasText: '联系客服' }).click()
    await expect(page).toHaveURL(/\/support$/)
    await expect(page.getByRole('heading', { name: '联系客服' })).toBeVisible()
  })

  test('已登录访问：不触发 guestOnly 反向守卫', async ({ page, mockApi }) => {
    mockApi.registerUser()
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/support')
    // 停在 /support 而非被弹去 /dashboard
    await expect(page).toHaveURL(/\/support$/)
    await expect(page.getByRole('heading', { name: '联系客服' })).toBeVisible()
  })
})
