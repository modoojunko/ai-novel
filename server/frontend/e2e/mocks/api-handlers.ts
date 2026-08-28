import type { Page, Route } from '@playwright/test'
import { createTestUser, createTestDevice, type TestUser, type TestDevice } from './test-data'

/**
 * MockApi — 拦截所有 /api/* 请求并返回模拟数据。
 * 使用精确路径匹配避免干扰 Vite 的模块加载。
 */
export class MockApi {
  private page: Page
  private currentUser: TestUser | null = null
  private devices: TestDevice[] = []
  /** 会话失效模式：/user/me 返回 HTTP 200 + code 1（与真实后端「用户不存在/未登录」一致） */
  private userMeDead = false
  /** 让接下来 N 次 /user/preferences 失败（测「保存失败→重试→落库」路径） */
  private preferencesFailCount = 0
  private routes: string[] = [
    '**/api/web/login',
    '**/api/web/register',
    '**/api/user/me',
    '**/api/user/password',
    '**/api/user/security',
    '**/api/user/preferences',
    '**/api/license/activate',
    '**/api/device/my',
    '**/api/device/remove',
    '**/api/authorize',
    '**/api/reset_password',
    // ⚠️ 真实调用带 query（?pc_hash=），Playwright glob 匹配完整 URL，须以 * 收尾
    '**/api/check-auth*',
  ]

  constructor(page: Page) {
    this.page = page
  }

  /** 在每次测试前调用：重置状态 + 注册路由拦截 */
  async setup(): Promise<void> {
    this.currentUser = null
    this.devices = []
    this.userMeDead = false
    this.preferencesFailCount = 0
    // 兜底拦最先注册（Playwright 后注册者优先，兜底必须排最前）。
    // 用谓词而非 glob：'**/api/**' 会误吞 vite 模块 URL（/src/api/request.ts
    // 路径里也含 '/api/'，被答成 JSON 应用直接起不来，PR #217 调试实测）。
    // 漏出精确路由表的 /api 一律答 code 1——绝不穿透 vite proxy（CI 上
    // 19000 无人监听，漏网即门闩 15s×4 空转、页面用例集体超时），也绝不
    // 返回 code 2 误触发 401 登出。
    await this.page.route(
      (url) => url.pathname.startsWith('/api/'),
      (route) => route.fulfill(json(1, 'unmocked api'))
    )
    for (const url of this.routes) {
      await this.page.route(url, (route) => this.handler(route))
    }
  }

  registerUser(overrides: Partial<TestUser> = {}): TestUser {
    const user = createTestUser(overrides)
    this.currentUser = user
    this.devices = [
      createTestDevice({ is_current: true, activated: true }, 1),
      createTestDevice({ activated: false, reason: { code: 'limit_exceeded', message: '超出设备限额' } }, 2),
    ]
    return user
  }

  setLoggedIn(user: TestUser): void {
    this.currentUser = user
    this.devices = [
      createTestDevice({ is_current: true, activated: true }, 1),
      createTestDevice({ activated: true }, 2),
    ]
  }

  /** 模拟真实后端「会话失效」：残留 token 有效格式但用户已不存在/未登录（HTTP 200 + code 1） */
  setDeadSession(): void {
    this.currentUser = null
    this.userMeDead = true
  }

  /** 让接下来 N 次 /user/preferences 返回 500（网络/服务端失败） */
  failPreferences(times = 1): void {
    this.preferencesFailCount = times
  }

  get token(): string {
    return this.currentUser?.token || ''
  }

  private async handler(route: Route): Promise<void> {
    const url = new URL(route.request().url())
    const path = url.pathname
    const method = route.request().method()

    // ── 预热探测（冷启动门闩）──
    // 真实后端对空 pc_hash 返回 code 1；任何带业务 code 的应答都代表「实例已热」，
    // 门闩（warmUpBackend）据此立即放行。不 mock 会穿透到真实网络，e2e 里门闩
    // 会空转重试 60s 导致所有页面数据用例超时。
    if (path === '/api/check-auth') {
      return route.fulfill(json(1, '缺少 pc_hash'))
    }

    // ── C端 冻结契约 ──
    if (path === '/api/authorize' && method === 'POST') {
      const body = route.request().postDataJSON()
      if (!body?.username || !body?.password) {
        return route.fulfill(json(1, '用户名或密码不能为空'))
      }
      return route.fulfill(json(0, {
        message: '设备授权成功',
        tier: 'trial',
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      }))
    }

    if (path === '/api/reset_password' && method === 'POST') {
      return route.fulfill(json(0, { success: true }))
    }

    // ── 门户 API ──
    if (path === '/api/web/login' && method === 'POST') {
      const body = route.request().postDataJSON()
      if (!this.currentUser || body.username !== this.currentUser.username) {
        return route.fulfill(json(1, '用户名或密码错误'))
      }
      return route.fulfill(json(0, {
        token: this.currentUser.token,
        tier: this.currentUser.tier,
        expires_at: this.currentUser.expires_at,
        theme: this.currentUser.theme,
      }))
    }

    if (path === '/api/web/register' && method === 'POST') {
      const body = route.request().postDataJSON()
      if (!body?.username || !body?.password) {
        return route.fulfill(json(1, '请填写完整信息'))
      }
      this.registerUser({ username: body.username, password: body.password })
      return route.fulfill(json(0, {
        token: this.currentUser!.token,
        tier: this.currentUser!.tier,
        expires_at: this.currentUser!.expires_at,
      }))
    }

    if (path === '/api/user/me' && method === 'GET') {
      if (this.userMeDead) {
        return route.fulfill(json(1, null))
      }
      if (!this.currentUser) {
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 2, msg: '未登录' }) })
      }
      return route.fulfill(json(0, {
        username: this.currentUser.username,
        tier: this.currentUser.tier,
        expires_at: this.currentUser.expires_at,
        is_valid: this.currentUser.is_valid,
        theme: this.currentUser.theme,
      }))
    }

    if (path === '/api/user/preferences' && method === 'PUT') {
      if (this.preferencesFailCount > 0) {
        this.preferencesFailCount--
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, msg: 'mock preferences fail' }) })
      }
      const body = route.request().postDataJSON()
      const known = ['teal', 'ink', 'bamboo', 'rouge', 'wisteria', 'celadon']
      if (!known.includes(body?.theme)) {
        return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ code: 422, msg: `不支持的主题：${body?.theme}` }) })
      }
      this.currentUser!.theme = body.theme
      return route.fulfill(json(0, { theme: body.theme }))
    }

    if (path === '/api/user/password' && method === 'PUT') {
      const body = route.request().postDataJSON()
      if (!body?.old_password || !body?.new_password) {
        return route.fulfill(json(1, '请填写完整信息'))
      }
      if (body.new_password.length < 6) {
        return route.fulfill(json(1, '密码至少 6 位'))
      }
      if (body.old_password === body.new_password) {
        return route.fulfill(json(1, '新密码不能与旧密码相同'))
      }
      return route.fulfill(json(0, { success: true }))
    }

    if (path === '/api/user/security' && method === 'PUT') {
      return route.fulfill(json(0, { success: true }))
    }

    if (path === '/api/license/activate' && method === 'POST') {
      const body = route.request().postDataJSON()
      if (!body?.code || body.code.length < 10) {
        return route.fulfill(json(1, '无效的激活码'))
      }
      return route.fulfill(json(0, {
        new_expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
      }))
    }

    if (path === '/api/device/my' && method === 'GET') {
      const activatedCount = this.devices.filter(d => d.activated).length
      return route.fulfill(json(0, this.devices, {
        total_count: this.devices.length,
        activated_count: activatedCount,
        active_limit: 3,
      }))
    }

    if (path === '/api/device/remove' && method === 'POST') {
      const body = route.request().postDataJSON()
      this.devices = this.devices.filter(d => d.id !== body?.id)
      return route.fulfill(json(0, { success: true }))
    }

    // 未匹配 → 让请求正常通过
    return route.fallback()
  }
}

function json(code: number, data: any, extra: Record<string, any> = {}): any {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code, msg: code === 0 ? 'ok' : 'error', data, ...extra }),
  }
}
