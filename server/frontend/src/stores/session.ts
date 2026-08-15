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
  async function login(usernameInput: string, password: string): Promise<{ ok: boolean; msg?: string }> {
    isLoading.value = true
    try {
      const res = await apiWebLogin(usernameInput, password)
      if (res.code === 0 && res.data) {
        token.value = res.data.token
        tier.value = res.data.tier || 'none'
        expiresAt.value = res.data.expires_at || ''
        localStorage.setItem('token', res.data.token)
        username.value = usernameInput
        isValid.value = true
        userFetched.value = false
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
        token.value = res.data.token
        tier.value = res.data.tier || 'trial'
        expiresAt.value = res.data.expires_at || ''
        username.value = usernameInput
        localStorage.setItem('token', res.data.token)
        isValid.value = true
        userFetched.value = false
        return { ok: true }
      }
      return { ok: false, msg: res.msg || '注册失败' }
    } catch (e: any) {
      return { ok: false, msg: e.message || '网络错误' }
    } finally {
      isLoading.value = false
    }
  }

  async function fetchUserInfo(): Promise<void> {
    if (!token.value) return
    isLoading.value = true
    try {
      const res = await apiUserMe()
      if (res.code === 0 && res.data) {
        username.value = res.data.username || ''
        tier.value = res.data.tier || 'none'
        expiresAt.value = res.data.expires_at || ''
        isValid.value = !!res.data.is_valid
      }
    } catch {
      // silent
    } finally {
      isLoading.value = false
      userFetched.value = true
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
