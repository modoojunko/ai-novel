import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiWebLogin, apiWebRegister, apiUserMe, apiUserPreferences } from '@/api/web'
import { warmUpBackend } from '@/api/request'
import { DEFAULT_THEME_KEY, isKnownThemeKey } from '@/constants/themes'

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
  const theme = ref<string>(DEFAULT_THEME_KEY)

  // ── Getters ──
  const isLoggedIn = computed(() => !!token.value)
  const hasLicense = computed(() => tier.value !== 'none' && isValid.value)

  // ── Actions ──
  /** 应用界面主题（DOM 层）：仅控制台入口调用（DashboardLayout 挂载 / 选择器操作），
   *  landing/auth 永远默认渲染——fetchUserInfo 只存 ref 不碰 DOM。 */
  function applyTheme(key: string | null | undefined): void {
    const t = isKnownThemeKey(key) ? key! : DEFAULT_THEME_KEY
    theme.value = t
    const el = document.documentElement
    if (t === DEFAULT_THEME_KEY) el.removeAttribute('data-theme')
    else el.setAttribute('data-theme', t)
  }

  /** 仅记录主题到 store（me/login 响应），DOM 应用交给控制台入口。 */
  function recordTheme(key: string | null | undefined): void {
    theme.value = isKnownThemeKey(key) ? key! : DEFAULT_THEME_KEY
  }

  /** 选择器入口：立即生效 + PUT 持久化；失败时不回滚视觉（所见即当前态），由调用方提示重试。
   *  与 login/fetchUserInfo 同款的冷启动自愈：先过预热门闩；网络错误（无响应，
   *  典型 = 云托管缩零后首个请求的 503 无 CORS 头）延迟重试一次——失败请求本身
   *  已触发扩容，等一拍再发通常即成功。二次仍失败才交给调用方弹通知。 */
  const SAVE_THEME_RETRY_MS = Number(import.meta.env.VITE_THEME_RETRY_MS) || 15_000

  async function putThemeOnce(key: string): Promise<{ ok: boolean; msg?: string }> {
    const res = await apiUserPreferences(key)
    if (res.code === 0) return { ok: true }
    return { ok: false, msg: res.msg || '保存失败' }
  }

  async function saveTheme(key: string): Promise<{ ok: boolean; msg?: string }> {
    applyTheme(key)
    try {
      await warmUpBackend()
      return await putThemeOnce(key)
    } catch (e: any) {
      // 有业务 code 的失败（拦截器挂在 Error.code 上）不重试；无 code = 传输/HTTP 层失败
      const retryable = e?.code === undefined
      if (!retryable) return { ok: false, msg: e.message || '网络错误' }
      await new Promise((r) => setTimeout(r, SAVE_THEME_RETRY_MS))
      try {
        return await putThemeOnce(key)
      } catch (e2: any) {
        return { ok: false, msg: e2.message || '网络错误' }
      }
    }
  }

  function applyAuthData(data: { token?: string; tier?: string; expires_at?: string; theme?: string }, usernameInput: string, defaultTier = 'none'): void {
    token.value = data.token || ''
    tier.value = data.tier || defaultTier
    expiresAt.value = data.expires_at || ''
    username.value = usernameInput
    localStorage.setItem('token', token.value)
    isValid.value = true
    userFetched.value = false
    if (data.theme !== undefined) recordTheme(data.theme)
  }

  async function login(
    usernameInput: string,
    password: string,
  ): Promise<{ ok: boolean; msg?: string; deletionPending?: { days_left: number; deadline: string }; accountDeleted?: boolean }> {
    isLoading.value = true
    try {
      // 冷启动门闩：等预热完成（共享 Promise）再发真实请求，避免直接撞 503
      await warmUpBackend()
      const res = await apiWebLogin(usernameInput, password)
      if (res.code === 0 && res.data) {
        applyAuthData(res.data, usernameInput)
        return { ok: true }
      }
      return { ok: false, msg: res.msg || '登录失败' }
    } catch (e: any) {
      // account-deletion（拦截器 reject，code/data 挂在 Error 上）：
      // code 4 = 撤销期结构化状态（避开 code 2=会话失效的全局硬跳）；data.deleted = 已注销终态
      if (e?.code === 4 && e?.data?.deletion_pending) {
        return {
          ok: false,
          msg: e.message || '账号注销进行中',
          deletionPending: { days_left: e.data.days_left ?? 0, deadline: e.data.deadline ?? '' },
        }
      }
      if (e?.data?.deleted) {
        return { ok: false, msg: e.message || '该账号已注销', accountDeleted: true }
      }
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
      await warmUpBackend()
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
  let fetchRetryTimer: ReturnType<typeof setTimeout> | undefined

  async function fetchUserInfo(retryDelays: number[] = FETCH_RETRY_DELAYS_MS): Promise<void> {
    if (!token.value) {
      // 复位重试链遗留的 loading：挂起期间被登出后若不复位，
      // isLoading=true 会让登录/注册按钮（:loading 即禁用）永久不可点
      isLoading.value = false
      return
    }
    isLoading.value = true
    let retrying = false
    try {
      // 先等预热门闩（与站点加载的 warmUpBackend 共享同一 Promise），
      // 避免挂载期数据请求与预热赛跑；后续网络错误仍有下面的重试链兜底
      await warmUpBackend()
      const res = await apiUserMe()
      if (res.code === 0 && res.data) {
        username.value = res.data.username || ''
        tier.value = res.data.tier || 'none'
        expiresAt.value = res.data.expires_at || ''
        isValid.value = !!res.data.is_valid
        if (res.data.theme !== undefined) recordTheme(res.data.theme)
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
        fetchRetryTimer = setTimeout(() => { fetchUserInfo(rest) }, delay)
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
    // 终止挂起的 fetchUserInfo 重试链并复位 loading（重试期间的登出）
    if (fetchRetryTimer) {
      clearTimeout(fetchRetryTimer)
      fetchRetryTimer = undefined
    }
    isLoading.value = false
    token.value = ''
    username.value = ''
    tier.value = 'none'
    expiresAt.value = ''
    isValid.value = false
    userFetched.value = false
    applyTheme(DEFAULT_THEME_KEY)
    localStorage.removeItem('token')
  }

  return {
    token, username, tier, tierDisplay, expiresAt, isValid, isLoading, userFetched, theme,
    isLoggedIn, hasLicense,
    login, register, fetchUserInfo, logout, applyTheme, recordTheme, saveTheme,
  }
})
