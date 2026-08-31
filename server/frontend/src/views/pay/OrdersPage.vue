<script setup lang="ts">
/**
 * 我的订单——全部状态订单列表（行内零动作，唯一动作=详情）。
 * 设计事实源：docs/design-s/prototypes/orders.html
 */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  apiPayOrders, fenToYuan, fmtBj, mmss, orderTitle, periodDaysLabel,
  statusLabel, statusPillClass,
  type OrderListItem,
} from '@/api/pay'

const router = useRouter()
const loading = ref(true)
const items = ref<OrderListItem[]>([])

function orderSub(o: OrderListItem): string {
  const no = `订单号 ${o.order_no.slice(0, 1)}…${o.order_no.slice(-4)}`
  if (o.status === 'pending') {
    const ttl = o.remaining_pay_seconds != null ? ` · 二维码有效期剩 ${mmss(o.remaining_pay_seconds)}` : ''
    return `${fmtBj(o.created_at)} 创建${ttl}`
  }
  if (o.status === 'refunded') return `订单号 ${o.order_no} · ${fmtBj(o.refunded_at)} 退款 ${fenToYuan(o.refund_amount_fen ?? 0)}`
  if (o.status === 'exception') return `订单号 ${o.order_no} · 支付金额核对中，暂未到账`
  if (o.paid_at) return `订单号 ${o.order_no} · ${fmtBj(o.paid_at)} 支付`
  return `订单号 ${o.order_no} · ${fmtBj(o.created_at)} 创建`
}

onMounted(async () => {
  try {
    const res = await apiPayOrders()
    items.value = res.items
  } catch (e) {
    console.error('orders load failed:', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="orders-page">
    <div class="page-head">
      <div>
        <h1>我的订单</h1>
        <div class="sub">全部订单（含等待支付、退款中、已过期等各类状态）都在这里，可对任一订单单独申请退款；点订单查看详情与全部操作。</div>
      </div>
      <button class="btn btn-primary" @click="router.push('/pay')">购买或续费</button>
    </div>

    <div v-if="loading" class="loading">加载中…</div>

    <!-- 空态 -->
    <div v-else-if="items.length === 0" class="empty">
      <div class="serif">还没有订单</div>
      <p>购买套餐后，订单与时长明细会展示在这里。</p>
      <button class="btn btn-primary" @click="router.push('/pay')">去购买套餐</button>
    </div>

    <!-- 列表 -->
    <template v-else>
      <div class="panel">
        <div
          v-for="o in items" :key="o.order_no"
          class="order-row" role="link" tabindex="0"
          @click="router.push(`/dashboard/orders/${o.order_no}`)"
          @keydown.enter="router.push(`/dashboard/orders/${o.order_no}`)"
        >
          <div class="order-main">
            <div class="order-title">
              <b>{{ orderTitle(o.snapshot) }}</b>
              <span v-if="periodDaysLabel(o.snapshot)" class="pill pill-tag">{{ periodDaysLabel(o.snapshot) }}</span>
            </div>
            <div class="order-sub"><span class="num">{{ o.order_no }}</span><span class="sub-text">{{ orderSub(o).replace(o.order_no, '') }}</span></div>
          </div>
          <div class="order-amt">
            <span class="v num" :class="{ refunded: o.status === 'refunded' }">{{ fenToYuan(o.amount_fen) }}</span>
            <span :class="statusPillClass(o.status)">{{ statusLabel(o.status) }}</span>
            <span v-if="o.refund_amount_fen && o.status === 'refund_pending'" class="r">预计退 {{ fenToYuan(o.refund_amount_fen) }}</span>
            <span v-if="o.refund_amount_fen && o.status === 'refund_processing'" class="r">预计退 {{ fenToYuan(o.refund_amount_fen) }}</span>
          </div>
          <span class="lnk">详情 ›</span>
        </div>
      </div>
      <div class="notice info tail">
        退款按剩余时长折算、原路退回；退某一单不影响其他套餐的起止时间。见退款政策。
      </div>
    </template>
  </div>
</template>

<style scoped>
.orders-page { max-width: 860px; margin: 0 auto; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.page-head h1 { font-family: var(--font-display); font-size: 26px; font-weight: 600; margin: 0; }
.page-head .sub { font-size: 13px; color: var(--muted); margin-top: 6px; max-width: 560px; }
.loading { padding: 60px; text-align: center; color: var(--muted); }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 6px 0; }
.order-row {
  display: grid; grid-template-columns: 1fr 148px 64px; align-items: center; gap: 12px;
  padding: 14px 22px; cursor: pointer; border-bottom: 1px solid var(--border);
}
.order-row:last-child { border-bottom: none; }
.order-row:hover { background: color-mix(in oklch, var(--fg) 3%, transparent); }
.order-title { display: flex; align-items: center; gap: 8px; font-size: 14.5px; }
.order-sub { display: flex; gap: 6px; font-size: 12px; color: var(--muted); margin-top: 4px; align-items: baseline; min-width: 0; }
.order-sub .num { font-family: var(--font-mono); }
.sub-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.order-amt { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
.order-amt .v { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 14.5px; }
.order-amt .v.refunded { text-decoration: line-through; color: var(--muted); }
.order-amt .r { font-size: 11.5px; color: var(--warn, var(--muted)); }
.lnk { color: var(--accent, var(--fg)); font-size: 12.5px; text-align: right; white-space: nowrap; }
.notice.tail { margin-top: 14px; }
.empty { border: 1px dashed var(--border); border-radius: var(--radius-lg); padding: 64px 32px; text-align: center; color: var(--muted); }
.empty .serif { font-family: var(--font-display); font-size: 19px; color: var(--fg); }
.empty p { margin: 8px 0 0; font-size: 13.5px; }
.empty .btn { margin-top: 16px; }
</style>
