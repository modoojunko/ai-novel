import request from './request'
import type { ApiResponse } from './request'

export function apiAuthorize(
  username: string,
  password: string,
  pc_hash: string,
  pc_name?: string,
  device_profile?: string,
): Promise<ApiResponse<{ message: string; tier: string; expires_at: string }>> {
  return request.post('/authorize', { username, password, pc_hash, pc_name, device_profile }).then(r => r.data)
}

export function apiResetPassword(
  username: string,
  security_answer: string,
  new_password: string,
): Promise<ApiResponse> {
  return request.post('/reset_password', { username, security_answer, new_password }).then(r => r.data)
}
