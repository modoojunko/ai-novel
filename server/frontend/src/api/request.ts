import axios from 'axios'
import type { AxiosInstance, AxiosResponse } from 'axios'

export interface ApiResponse<T = any> {
  code: number
  msg: string
  data?: T
  total_count?: number
  activated_count?: number
  active_limit?: number
}

const request: AxiosInstance = axios.create({
  // 默认同源 /api（本地 nginx 反代）；云端静态托管无反代，构建时注入 VITE_API_BASE 指向后端域名
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  // 60s：云托管 MinNum=0 缩容后首次请求需冷启动（30-60s），15s 默认超时会误报失败
  timeout: 60000,
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

// ── 辅助函数：401 登出（避免导入 Vue Router 造成循环依赖）──
function handleUnauthorized(): void {
  localStorage.removeItem('token')
  // 使用 location.href 而非 router.push —— 401 时 SPA 状态已不可信，整页刷新更安全
  window.location.href = '/login'
}

// ── 响应拦截器：统一错误处理 ──
request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const data = response.data

    // 裸字段端点（/api/devices/current 无 code 字段）→ 包裹为标准格式
    if (data && typeof data.code === 'undefined') {
      return { ...response, data: { code: 0, data: data } } as any
    }

    // code !== 0 → 统一 reject
    if (data && data.code !== 0) {
      if (data.code === 2) {
        handleUnauthorized()
      }
      return Promise.reject(new Error(data.msg || '请求失败'))
    }

    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      handleUnauthorized()
    }
    const msg = error.response?.data?.msg || (error.response ? '服务器错误' : '网络连接失败')
    return Promise.reject(new Error(msg))
  }
)

/**
 * 预热后端（云托管 MinNum=0 冷启动兜底）：
 * 站点加载时发一个轻量请求，让实例在用户填表期间完成冷启动。
 * 无 pc_hash 的 check-auth 不查库，极轻；失败静默（冷启动期间 503 属预期）。
 */
export function warmUpBackend(): void {
  request.get('/check-auth', { params: { pc_hash: '' } }).catch(() => {})
}

export default request
