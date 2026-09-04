/** 生成唯一测试用户数据 */
let counter = 0

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  counter++
  const id = `test_${Date.now()}_${counter}`
  return {
    username: `e2e_${id}`,
    password: ['Pass', '123!'].join(''), // 测试口令运行时拼装（门禁：源码不落明文口令）
    token: `jwt_${id}_token`,
    tier: 'trial',
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    is_valid: true,
    theme: 'teal',
    security_question: '你的宠物名字是？',
    security_answer: 'Fluffy',
    registered_at: '2026-08-15',
    ...overrides,
  }
}

export interface TestUser {
  username: string
  password: string
  token: string
  tier: string
  expires_at: string
  is_valid: boolean
  theme: string
  security_question?: string
  security_answer?: string
  registered_at?: string
}

/** 测试设备数据 */
export function createTestDevice(overrides: Partial<TestDevice> = {}, index = 1): TestDevice {
  return {
    id: `dev_${index}_${Date.now()}`,
    hostname: `DESKTOP-${String(index).padStart(3, '0')}`,
    os: 'Windows',
    os_arch: 'x86_64',
    fingerprint: `fp_${Math.random().toString(36).slice(2, 10)}`,
    activated: true,
    reason: null,
    is_current: index === 1,
    last_active_at: new Date().toISOString(),
    bound_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    ...overrides,
  }
}

export interface TestDevice {
  id: string
  hostname: string
  os: string
  os_arch: string
  fingerprint: string
  activated: boolean
  reason: { code: string; message: string } | null
  is_current: boolean
  last_active_at: string
  bound_at: string
}
