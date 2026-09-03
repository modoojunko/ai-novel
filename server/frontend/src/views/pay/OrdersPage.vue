<script setup lang="ts">
/**
 * 我的订单——tab 五版分版列表（行内零动作，唯一动作=详情）。
 * 设计事实源：docs/design-s/prototypes/orders.html（2026-09-02 tab 分版修订版）
 * 默认版=待支付；各 tab 独立分页（加载更多）；?tab= 路由同步。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  apiPayOrders, fenToYuan, fmtBj, mmss, orderTitle, periodDaysLabel,
  statusLabel, statusPillClass,
  DEFAULT_ORDER_TAB, ORDER_TABS, orderTabFromQuery,
  type OrderListItem, type OrderTabKey,
} from '@/api/pay'

const PAGE_SIZE = 20

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const loadingMore = ref(false)
/** 切版/刷新中（有旧数据时的局部加载态：旧列表置灰，不整页白屏） */
const refreshing = ref(false)
const items = ref<OrderListItem[]>([])
const total = ref(0)
const activeTab = ref<OrderTabKey>(orderTabFromQuery(route.query.tab))
/** 整页空态（账号无任何订单）——与「某类空」区分，tab 条不渲染 */
const pageEmpty = ref(false)

const tabLabel = computed(() => ORDER_TABS.find((t) => t.key === activeTab.value)?.label ?? '')
const statusList = computed(() => ORDER_TABS.find((t) => t.key === activeTab.value)?.statuses)
const hasMore = computed(() => items.value.length < total.value)

/** tab 会话令牌：切走后返回的过期响应直接丢弃（design D7） */
let tabToken = 0
/** 首载已完成标记：整页 loading 只用于进页首取；切 tab 一律局部刷新（从某类空 tab 切出也绝不整页闪，同 LicensePage 8714e0c 热修） */
let firstLoadDone = false
/** 置灰延迟：请求超过 200ms 才置灰旧列表——秒回的切版全程无灰闪 */
let dimTimer: number | undefined
const DIM_DELAY_MS = 200

async function fetchPage(reset: boolean): Promise<void> {
  const token = ++tabToken
  if (reset) {
    // 切版/刷新不清空旧列表（orders-page-latency）：置灰局部加载；整页 loading 仅限进页首取
    if (firstLoadDone) {
      dimTimer = window.setTimeout(() => {
        if (token === tabToken) refreshing.value = true
      }, DIM_DELAY_MS)
    } else {
      loading.value = true
    }
  } else {
    loadingMore.value = true
  }
  const page = reset ? 1 : Math.floor(items.value.length / PAGE_SIZE) + 1
  const statuses = statusList.value ?? undefined
  try {
    // 探测与主请求并行（改前 total=0 时串行两连发）；「全部」tab total 即账号全量免探测
    const [res, probe] = await Promise.all([
      apiPayOrders(page, PAGE_SIZE, statuses),
      reset && statuses ? apiPayOrders(1, 1) : Promise.resolve(null),
    ])
    if (token !== tabToken) return
    total.value = res.total
    if (reset) {
      items.value = res.items
      // 整页空态判定口径不变：过滤 tab 看账号全量探测，「全部」tab 看自身 total
      pageEmpty.value = (probe ? probe.total : res.total) === 0
    } else {
      const seen = new Set(items.value.map((o) => o.order_no))
      items.value = [...items.value, ...res.items.filter((o) => !seen.has(o.order_no))]
    }
  } catch (e) {
    // 失败保留旧列表原样，MUST NOT 误显示空态
    console.error('orders load failed:', e)
  } finally {
    window.clearTimeout(dimTimer)
    if (token === tabToken) {
      firstLoadDone = true
      loading.value = false
      loadingMore.value = false
      refreshing.value = false
    }
  }
}

/** 切 tab：URL query 同步（默认版省略参数保持 URL 干净；replace 不进历史栈） */
function switchTab(key: OrderTabKey): void {
  if (key === activeTab.value) return
  activeTab.value = key
  router.replace({ query: { ...route.query, tab: key === DEFAULT_ORDER_TAB ? undefined : key } })
}

// 浏览器回退/前进改 query → 只还原 tab；刷新统一由 watch(activeTab) 触发（避免双请求）
watch(() => route.query.tab, (v) => {
  const key = orderTabFromQuery(v)
  if (key !== activeTab.value) activeTab.value = key
})

// 切 tab（switchTab）与 URL 还原两条路径的刷新都收敛到这里
watch(activeTab, () => fetchPage(true))

onMounted(() => fetchPage(true))

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
</script>

<template>
  <div class="orders-page">
    <div class="page-head">
      <div>
        <h1>我的订单</h1>
        <div class="sub">订单按状态分版：全部、待支付、已完成、退款、已过期；点订单查看详情与全部操作，可对任一订单单独申请退款。</div>
      </div>
      <button class="btn btn-primary" @click="router.push('/pay')">购买或续费</button>
    </div>

    <div v-if="loading" class="loading">加载中…</div>

    <!-- 整页空态（账号无任何订单）：tab 条不渲染 -->
    <div v-else-if="pageEmpty" class="empty">
      <div class="serif">还没有订单</div>
      <p>购买套餐后，订单与时长明细会展示在这里。</p>
      <button class="btn btn-primary" @click="router.push('/pay')">去购买套餐</button>
    </div>

    <template v-else>
      <div class="seg seg-row" role="tablist" aria-label="订单状态分版">
        <button
          v-for="t in ORDER_TABS" :key="t.key"
          :class="{ on: t.key === activeTab }"
          @click="switchTab(t.key)"
        >{{ t.label }}</button>
      </div>

      <!-- 某类空态 -->
      <div v-if="items.length === 0" class="panel tab-empty">
        <p>没有{{ tabLabel }}的订单</p>
        <button v-if="activeTab !== 'all'" class="lnk" @click="switchTab('all')">切回全部查看</button>
      </div>

      <!-- 列表 -->
      <template v-else>
        <div class="panel" :class="{ refreshing }">
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
              <span v-if="o.refund_amount_fen && (o.status === 'refund_pending' || o.status === 'refund_processing')" class="r">预计退 {{ fenToYuan(o.refund_amount_fen) }}</span>
            </div>
            <span class="lnk">详情 ›</span>
          </div>
        </div>
        <div class="list-tail">
          <span class="cnt">{{ refreshing ? '加载中…' : `已显示 ${items.length} 笔 · 共 ${total} 笔` }}</span>
          <button v-if="hasMore" class="btn btn-secondary" :disabled="loadingMore" @click="fetchPage(false)">
            {{ loadingMore ? '加载中…' : '加载更多' }}
          </button>
        </div>
      </template>
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
.seg-row { margin-bottom: 16px; }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 6px 0; transition: opacity .15s; }
.panel.refreshing { opacity: .5; pointer-events: none; }
.tab-empty { padding: 40px 16px; text-align: center; color: var(--muted); font-size: 13.5px; }
.tab-empty p { margin: 0 0 6px; }
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
.list-tail { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 14px; }
.list-tail .cnt { font-size: 12.5px; color: var(--muted); }
.notice.tail { margin-top: 14px; }
.empty { border: 1px dashed var(--border); border-radius: var(--radius-lg); padding: 64px 32px; text-align: center; color: var(--muted); }
.empty .serif { font-family: var(--font-display); font-size: 19px; color: var(--fg); }
.empty p { margin: 8px 0 0; font-size: 13.5px; }
.empty .btn { margin-top: 16px; }
</style>
