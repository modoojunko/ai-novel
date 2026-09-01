import request from './request'
import type { ApiResponse } from './request'

// ── 账户 ──

export function apiWebLogin(
  username: string,
  password: string,
): Promise<ApiResponse<{
  token: string; tier: string; expires_at: string; theme: string;
  // 注销链路（account-deletion）：撤销期 code=4 结构化状态 / 已注销 code=1 + deleted 标记
  deletion_pending?: boolean; days_left?: number; deadline?: string; deleted?: boolean;
}>> {
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
  // account-blocks-unify：密保只回问题文本（答案从不下发）；注册时间 YYYY-MM-DD
  security_question?: string
  registered_at?: string
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

// ── 账号注销（account-deletion）──

export interface BlockedAsset {
  code_id: string
  tier: string
  status: string
  duration_days: number
  expires_at: string
  refund_requested?: boolean
  has_order?: boolean
  order_id?: number
}

export interface DeletionStatusData {
  pending: boolean
  deleted?: boolean
  days_left?: number
  deadline?: string
  requested_at?: string
}

export function apiDeletionStatus(): Promise<ApiResponse<DeletionStatusData>> {
  return request.get('/user/deletion-status').then(r => r.data)
}

export function apiDeletionAssets(): Promise<ApiResponse<{ blocked_assets: BlockedAsset[] }>> {
  return request.get('/user/deletion-assets').then(r => r.data)
}

/** 权益级退款申请（登录态即身份；客服人工执行，15 个工作日口径）。 */
export function apiRequestAssetRefund(codeId: string): Promise<ApiResponse<{ code_id: string; refund_requested: boolean }>> {
  return request.post('/user/deletion/refund-request', { code_id: codeId }).then(r => r.data)
}

export function apiRequestDeletion(
  password: string,
  waive_assets: boolean,
): Promise<ApiResponse<{ pending?: boolean; days_left?: number; deadline?: string; blocked_assets?: BlockedAsset[] }>> {
  return request.post('/user/deletion', { password, waive_assets }).then(r => r.data)
}

/** 撤销期账号登录被拒、无 JWT——用户名+密码本身即身份证明（免 token）。 */
export function apiRevokeDeletion(username: string, password: string): Promise<ApiResponse> {
  return request.post('/user/deletion/revoke', { username, password }).then(r => r.data)
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
