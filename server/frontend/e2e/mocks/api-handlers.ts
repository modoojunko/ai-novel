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
  private routes: string[] = [
    '**/api/web/login',
    '**/api/web/register',
    '**/api/user/me',
    '**/api/user/password',
    '**/api/user/security',
    '**/api/license/activate',
    '**/api/device/my',
    '**/api/device/remove',
    '**/api/authorize',
    '**/api/reset_password',
  ]

  constructor(page: Page) {
    this.page = page
  }

  /** 在每次测试前调用：重置状态 + 注册路由拦截 */
  async setup(): Promise<void> {
    this.currentUser = null
    this.devices = []
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

  get token(): string {
    return this.currentUser?.token || ''
  }

  private async handler(route: Route): Promise<void> {
    const url = new URL(route.request().url())
    const path = url.pathname
    const method = route.request().method()

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
      if (!this.currentUser) {
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 2, msg: '未登录' }) })
      }
      return route.fulfill(json(0, {
        username: this.currentUser.username,
        tier: this.currentUser.tier,
        expires_at: this.currentUser.expires_at,
        is_valid: this.currentUser.is_valid,
      }))
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
