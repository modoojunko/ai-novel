/**
 * 支付 API 层——附录 Z 联合契约的前端消费。
 * 错误码 = 后端数字码 + 前端映射（Z.1）。
 */
import request from './request'
import type { ApiResponse } from './request'

// ── 类型定义（附录 Z DTO）──

export interface SkuItem {
  sku_key: string
  tier_key: string
  period: 'monthly' | 'quarterly' | 'yearly'
  period_days: number
  base_price_fen: number
  discount_display: string
  price_fen: number
  device_limit: number
}

export interface TierItem {
  key: string
  label: string
  is_live: boolean
}

export interface SkusView {
  purchase_enabled: boolean
  agreement_version: string
  tiers: TierItem[]
  skus: SkuItem[]
  popular_sku: string
  current?: {
    tier: string
    expires_at: string
    remaining_days: number
    pending_activation_count: number
  }
}

export interface CreateOrderResult {
  order_no: string
  amount_fen: number
  code_url: string
  status: string
  expires_at: string
  ttl_seconds: number
}

export interface OrderDetail {
  order_no: string
  status: string
  amount_fen: number
  created_at: string
  paid_at: string
  agreement?: { version: string; agreed_at: string }
  wx_transaction_id?: string
  remaining_pay_seconds?: number | null
  refund?: {
    status: string
    amount_fen?: number
    cooldown_remaining_seconds?: number | null
    wx_refund_id?: string
  } | null
  sku_snapshot?: Record<string, unknown>
}

export interface RefundPreview {
  refundable: boolean
  reason: string
  refund_fen?: number
  remaining_desc?: string
}

export interface RefundResult {
  order_no: string
  amount_fen: number
  refund_fen: number
  status: string
  cooldown_remaining_seconds: number
}

export interface MembershipView {
  tier: string
  remaining_sec: number
  remaining_desc: string
  max_expires_at: string | null
  pending_count: number
}

export interface ActivateResult {
  code_id: string
  grant_start: string
  expires_at: string
  tier: string
}

// ── API 调用 ──

export async function apiPaySkus(): Promise<SkusView> {
  const r = await request.get<ApiResponse<SkusView>>('/pay/skus')
  return r.data.data!
}

export async function apiPayCreateOrder(skuKey: string, agreementVersion: string): Promise<CreateOrderResult> {
  const r = await request.post<ApiResponse<CreateOrderResult>>('/pay/orders', {
    sku_key: skuKey,
    agreement_version: agreementVersion,
  })
  return r.data.data!
}

export async function apiPayPendingOrder(): Promise<{ order_no: string; amount_fen: number } | null> {
  const r = await request.get<ApiResponse<{ order_no: string; amount_fen: number } | null>>('/pay/orders/pending')
  return r.data.data ?? null
}

export async function apiPayOrderDetail(orderNo: string): Promise<OrderDetail> {
  const r = await request.get<ApiResponse<OrderDetail>>(`/pay/orders/${orderNo}`)
  return r.data.data!
}

export async function apiPayQueryOrder(orderNo: string): Promise<{ hit: boolean; hint: string }> {
  const r = await request.post<ApiResponse<{ hit: boolean; hint: string }>>(`/pay/orders/${orderNo}/query`)
  return r.data.data!
}

export async function apiPayCancelOrder(orderNo: string): Promise<void> {
  await request.post(`/pay/orders/${orderNo}/cancel`)
}

export async function apiPayRefundPreview(orderNo: string): Promise<RefundPreview> {
  const r = await request.get<ApiResponse<RefundPreview>>(`/pay/orders/${orderNo}/refund-preview`)
  return r.data.data!
}

export async function apiPayRequestRefund(orderNo: string, reason: string): Promise<RefundResult> {
  const r = await request.post<ApiResponse<RefundResult>>(`/pay/orders/${orderNo}/refund`, { reason })
  return r.data.data!
}

export async function apiPayCancelRefund(orderNo: string): Promise<{ grant_restored: boolean }> {
  const r = await request.post<ApiResponse<{ grant_restored: boolean }>>(`/pay/orders/${orderNo}/refund/cancel`)
  return r.data.data!
}

export async function apiPayMembership(): Promise<MembershipView> {
  const r = await request.get<ApiResponse<MembershipView>>('/pay/membership')
  return r.data.data!
}

export async function apiPayActivate(orderNo: string): Promise<ActivateResult> {
  const r = await request.post<ApiResponse<ActivateResult>>('/pay/grants/activate', { order_no: orderNo })
  return r.data.data!
}

// ── 工具函数 ──

export function fenToYuan(fen: number): string {
  return `¥${(fen / 100).toFixed(2)}`
}

export function fenToYuanShort(fen: number): string {
  return `¥${Math.round(fen / 100)}`
}

/** 订单状态 → UI 徽标类名（附录 Z 状态映射） */
export function statusPillClass(status: string): string {
  switch (status) {
    case 'pending': return 'pill-status pill-warn'
    case 'paid': case 'fulfilled': return 'pill-status pill-ok'
    case 'refund_pending': return 'pill-status pill-warn'
    case 'refund_processing': return 'pill-status pill-warn'
    case 'refunded': return 'pill-tag'
    case 'closed': return 'pill-tag'
    case 'exception': return 'pill-status pill-err'
    default: return 'pill-tag'
  }
}

/** 订单状态 → 中文标签 */
export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '等待支付',
    paid: '已支付',
    fulfilled: '已支付',
    refund_pending: '退款中·冷静期',
    refund_processing: '退款中',
    refunded: '已退款',
    closed: '已过期',
    exception: '核对中',
  }
  return map[status] || status
}
