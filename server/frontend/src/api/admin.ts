import request from './request'
import type { ApiResponse } from './request'

export function apiGenerateCode(
  admin_token: string,
  tier: string,
  count: number,
): Promise<ApiResponse<{ codes: string[]; count: number }>> {
  return request.post('/generate_code', { admin_token, tier, count }).then(r => r.data)
}

export function apiQueryCodes(
  admin_token: string,
  username?: string,
): Promise<ApiResponse<{
  codes: Array<{
    code_id: string
    tier: string
    status: string
    bound_username: string
    expires_at: string
    created_at: string
  }>
}>> {
  return request.post('/query_codes', { admin_token, username }).then(r => r.data)
}
