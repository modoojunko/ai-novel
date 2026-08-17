import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiWebLogin, apiWebRegister, apiUserMe } from '@/api/web'

export const useSessionStore = defineStore('session', () => {
  // ── State ──
  const token = ref<string>(localStorage.getItem('token') || '')
  const username = ref<string>('')
  const tier = ref<string>('none')
  const tierDisplay = computed(() => {
    const map: Record<string, string> = {
      trial: '试用', free: '免费', monthly: '月付',
      quarterly: '季付', yearly: '年付', lifetime: '永久', none: '无套餐',
    }
    return map[tier.value] || tier.value
  })
  const expiresAt = ref<string>('')
  const isValid = ref<boolean>(false)
  const isLoading = ref<boolean>(false)
  const userFetched = ref<boolean>(false)

  // ── Getters ──
  const isLoggedIn = computed(() => !!token.value)
  const hasLicense = computed(() => tier.value !== 'none' && isValid.value)

  // ── Actions ──
  function applyAuthData(data: { token?: string; tier?: string; expires_at?: string }, usernameInput: string, defaultTier = 'none'): void {
    token.value = data.token || ''
    tier.value = data.tier || defaultTier
    expiresAt.value = data.expires_at || ''
    username.value = usernameInput
    localStorage.setItem('token', token.value)
    isValid.value = true
    userFetched.value = false
  }

  async function login(usernameInput: string, password: string): Promise<{ ok: boolean; msg?: string }> {
    isLoading.value = true
    try {
      const res = await apiWebLogin(usernameInput, password)
      if (res.code === 0 && res.data) {
        applyAuthData(res.data, usernameInput)
        return { ok: true }
      }
      return { ok: false, msg: res.msg || '登录失败' }
    } catch (e: any) {
      return { ok: false, msg: e.message || '网络错误' }
    } finally {
      isLoading.value = false
    }
  }

  async function register(
    usernameInput: string,
    password: string,
    securityQuestion?: string,
    securityAnswer?: string,
  ): Promise<{ ok: boolean; msg?: string }> {
    isLoading.value = true
    try {
      const res = await apiWebRegister(usernameInput, password, securityQuestion, securityAnswer)
      if (res.code === 0 && res.data) {
        applyAuthData(res.data, usernameInput, 'trial')
        return { ok: true }
      }
      return { ok: false, msg: res.msg || '注册失败' }
    } catch (e: any) {
      return { ok: false, msg: e.message || '网络错误' }
    } finally {
      isLoading.value = false
    }
  }

  // 云托管 MinNum=0 缩容后冷启动 30-60s：/user/me 网络失败时延迟重试自愈
  // （失败请求本身已触发扩容）。仅重试无业务 code 的网络错误。
  const FETCH_RETRY_DELAYS_MS = [20_000, 20_000]

  async function fetchUserInfo(retryDelays: number[] = FETCH_RETRY_DELAYS_MS): Promise<void> {
    if (!token.value) return
    isLoading.value = true
    let retrying = false
    try {
      const res = await apiUserMe()
      if (res.code === 0 && res.data) {
        username.value = res.data.username || ''
        tier.value = res.data.tier || 'none'
        expiresAt.value = res.data.expires_at || ''
        isValid.value = !!res.data.is_valid
      }
    } catch (e: any) {
      // code 1 = 会话失效（token 无效 / 用户已不存在，如本地库重建后残留旧 token）。
      // 必须清掉本地会话，否则 isLoggedIn 只看 token 存在与否，会渲染出「已登录」
      // 但数据全空的壳。受保护页面硬跳 /login；公共页只清态（头部自动回到未登录）。
      if (e?.code === 1) {
        logout()
        if (window.location.pathname.startsWith('/dashboard')) {
          window.location.href = '/login'
        }
      } else if (retryDelays.length > 0 && e?.code === undefined) {
        // 网络错误（无业务 code）：后端正冷启动，保持 loading 并延迟重试；
        // 不置 userFetched，避免页面误判「已拉取」
        retrying = true
        const [delay, ...rest] = retryDelays
        setTimeout(() => { fetchUserInfo(rest) }, delay)
      }
      // 其余（业务失败）保持静默，由页面 loadError/重试兜底
    } finally {
      if (!retrying) {
        isLoading.value = false
        userFetched.value = true
      }
    }
  }

  function logout(): void {
    token.value = ''
    username.value = ''
    tier.value = 'none'
    expiresAt.value = ''
    isValid.value = false
    userFetched.value = false
    localStorage.removeItem('token')
  }

  return {
    token, username, tier, tierDisplay, expiresAt, isValid, isLoading, userFetched,
    isLoggedIn, hasLicense,
    login, register, fetchUserInfo, logout,
  }
})
