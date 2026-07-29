import axios from 'axios'
import type { AxiosInstance, AxiosResponse } from 'axios'
import { useSessionStore } from '@/stores/session'
import { useToastStore } from '@/stores/toast'
import router from '@/router'

export interface ApiResponse<T = any> {
  code: number
  msg: string
  data?: T
  total_count?: number
  activated_count?: number
  active_limit?: number
}

const request: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// ── 请求拦截器：自动注入 Authorization ──
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── 响应拦截器：统一错误处理 ──
request.interceptors.response.use(
  async (response: AxiosResponse<ApiResponse>) => {
    const data = response.data

    // 裸字段端点（/api/devices/current 无 code 字段）→ 包裹为标准格式
    if (data && typeof data.code === 'undefined') {
      return { ...response, data: { code: 0, data: data } } as any
    }

    // code !== 0 → 统一 reject
    if (data && data.code !== 0) {
      if (data.code === 2) {
        const toast = useToastStore()
        toast.show('登录已过期，请重新登录', 'warning')
        await new Promise(r => setTimeout(r, 50))
        const session = useSessionStore()
        session.logout()
        router.push('/login')
      }
      return Promise.reject(new Error(data.msg || '请求失败'))
    }

    return response
  },
  async (error) => {
    if (error.response?.status === 401) {
      const toast = useToastStore()
      toast.show('登录已过期，请重新登录', 'warning')
      await new Promise(r => setTimeout(r, 50))
      const session = useSessionStore()
      session.logout()
      router.push('/login')
    }
    const msg = error.response?.data?.msg || (error.response ? '服务器错误' : '网络连接失败')
    return Promise.reject(new Error(msg))
  }
)

export default request
