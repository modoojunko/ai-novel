import request from './request'
import type { ApiResponse } from './request'

// ── 账户 ──

export function apiWebLogin(
  username: string,
  password: string,
): Promise<ApiResponse<{ token: string; tier: string; expires_at: string; theme: string }>> {
  return request.post('/web/login', { username, password }).then(r => r.data)
}

export function apiWebRegister(
  username: string,
  password: string,
  security_question?: string,
  security_answer?: string,
): Promise<ApiResponse<{ token: string; tier: string; expires_at: string }>> {
  return request.post('/web/register', { username, password, security_question, security_answer }).then(r => r.data)
}

export function apiUserMe(): Promise<ApiResponse<{
  username: string
  tier: string
  expires_at: string
  is_valid: boolean
  theme: string
}>> {
  return request.get('/user/me').then(r => r.data)
}

export function apiUserPreferences(theme: string): Promise<ApiResponse<{ theme: string }>> {
  return request.put('/user/preferences', { theme }).then(r => r.data)
}

export function apiChangePassword(old_password: string, new_password: string): Promise<ApiResponse> {
  return request.put('/user/password', { old_password, new_password }).then(r => r.data)
}

export function apiSetSecurity(security_question: string, security_answer: string): Promise<ApiResponse> {
  return request.put('/user/security', { security_question, security_answer }).then(r => r.data)
}

// ── 设备 ──

export interface DeviceItem {
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

export function apiDeviceMy(): Promise<ApiResponse<DeviceItem[]>> {
  return request.get('/device/my').then(r => r.data)
}

export function apiDeviceRemove(id: string): Promise<ApiResponse> {
  return request.post('/device/remove', { id }).then(r => r.data)
}
