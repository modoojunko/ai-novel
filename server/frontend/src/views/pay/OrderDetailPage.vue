<script setup lang="ts">
/**
 * 订单详情——六态配置（paid/waiting/refund_pending/refund_processing/refunded/expired/exception）。
 * 设计事实源：docs/design-s/prototypes/order-detail.html（STATES 表照抄）
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  apiPayCancelOrder, apiPayCancelRefund, apiPayOrderDetail, fenToYuan, fmtBj,
  maskWxNo, orderTitle, periodDaysLabel, periodLabel,
  statusLabel, statusPillClass,
  type OrderDetail,
} from '@/api/pay'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const order = ref<OrderDetail | null>(null)
const err = ref('')

// ── 冷静期倒计时（refund_pending）──
const cooldownLeft = ref(0)
let timer: number | undefined

function startCooldown(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return
  cooldownLeft.value = seconds
  timer = window.setInterval(() => {
    cooldownLeft.value -= 1
    if (cooldownLeft.value <= 0) {
      window.clearInterval(timer)
      reload() // 归零 → 转 processing
    }
  }, 1000)
}

onBeforeUnmount(() => window.clearInterval(timer))

async function reload() {
  try {
    order.value = await apiPayOrderDetail(String(route.params.orderNo))
    if (order.value.status === 'refund_pending' && order.value.refund) {
      startCooldown(order.value.refund.cooldown_remaining_seconds)
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(reload)

// ── 状态归一（后端六态字段）──
const state = computed(() => order.value?.status ?? '')

const snapshot = computed(() => order.value?.snapshot ?? null)
const amount = computed(() => (order.value ? fenToYuan(order.value.amount_fen) : ''))

const stateNoticeKind = computed(() => {
  switch (state.value) {
    case 'paid': case 'fulfilled': return 'info'
    case 'pending': return 'warn'
    case 'refund_pending': case 'refund_processing': return 'warn'
    case 'refunded': case 'closed': return 'info'
    case 'exception': return 'err'
    default: return 'info'
  }
})

const stateNotice = computed(() => {
  const o = order.value
  if (!o) return ''
  switch (state.value) {
    case 'paid': case 'fulfilled':
      return `套餐已到货。计时从激活后开始；未激活前可全额退。`
    case 'pending':
      return `订单 15 分钟内有效，超时自动过期。二维码请在等待支付页查看。`
    case 'refund_pending': {
      const m = Math.floor(cooldownLeft.value / 60)
      const s = cooldownLeft.value % 60
      return `退款将在 ${m} 分 ${String(s).padStart(2, '0')} 秒后提交（套餐已停止使用）。冷静期内可取消恢复使用。`
    }
    case 'refund_processing':
      return `退款已受理，原路退回中；套餐已冻结停止使用。到账后本单转为已退款。`
    case 'refunded':
      return `退款已完成，原路退回您的微信；对应套餐已收回，其他套餐不受影响。`
    case 'closed':
      return `超时未支付自动过期，未产生扣款。重新下单按当前价格生成新订单。`
    case 'exception':
      return `已收到您的支付，系统正在核对金额，暂未到账。资金安全、不会丢失——请勿重复支付。核对完成将自动到账。`
    default: return ''
  }
})

// ── 时间线（数据来自订单/台账明确字段；到货当且仅当 fulfilled_at 非空，不以支付时间冒充）──
function daysLeft(expiresIso: string): number {
  if (!expiresIso) return 0
  let s = expiresIso
  if (!/[Zz]|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z' // naive UTC 补 Z（同 fmtBj 口径）
  return Math.max(0, Math.ceil((Date.parse(s) - Date.now()) / 86400000))
}

function estFromSeconds(seconds?: number | null): string {
  // 进行中环节预计时刻：剩余秒数 → 北京时间展示
  if (!seconds || seconds <= 0) return ''
  return fmtBj(new Date(Date.now() + seconds * 1000).toISOString())
}

const steps = computed(() => {
  const o = order.value
  if (!o) return []
  const rows: { title: string; when: string; done: boolean; now: boolean }[] = [{ title: '创建订单', when: fmtBj(o.created_at), done: true, now: false }]
  if (state.value === 'closed') {
    rows.push({ title: '超时关闭', when: '—', done: true, now: false })
    return rows
  }

  if (o.paid_at) {
    rows.push({ title: '支付成功', when: fmtBj(o.paid_at), done: true, now: false })
  } else {
    const est = estFromSeconds(o.remaining_pay_seconds)
    rows.push({ title: '等待支付', when: est ? `订单 ${est} 过期` : '', done: false, now: true })
  }
  if (state.value === 'pending') return rows

  // 套餐到货：fulfilled_at 非空才显示实际时间；已支付未到货（半截态）按进行中处理
  const g = o.grant
  if (o.fulfilled_at) {
    let title = '套餐到货'
    if (g?.status === 'active') title = `套餐到货（已激活，计时中）· 剩余 ${daysLeft(g.expires_at)} 天`
    else if (g?.status === 'pending_activation') title = '套餐到货（待激活，未计时）'
    else if (g?.status === 'revoked') title = '套餐到货（已收回）'
    rows.push({ title, when: fmtBj(o.fulfilled_at), done: true, now: false })
  } else if (state.value !== 'exception') {
    rows.push({ title: '套餐到货', when: '预计数分钟内', done: false, now: true })
  }

  const refundStatus = o.refund?.status
  if (o.refund_requested_at) {
    rows.push({ title: '申请退款', when: fmtBj(o.refund_requested_at), done: true, now: false })
  }
  if (refundStatus && refundStatus !== 'none') {
    if (state.value === 'refund_pending')
      rows.push({ title: '退款确认（冷静期）', when: estFromSeconds(o.refund?.cooldown_remaining_seconds), done: false, now: true })
    else if (state.value === 'refund_processing')
      rows.push({ title: '退款原路退回中', when: '预计 3 天内到账', done: false, now: true })
    else if (state.value === 'refunded')
      rows.push({ title: '退款完成（原路退回）', when: fmtBj(o.refunded_at || ''), done: true, now: false })
    else if (refundStatus === 'canceled')
      rows.push({ title: '退款已取消（恢复使用）', when: '', done: true, now: false })
  } else if (state.value !== 'exception' && state.value !== 'refunded') {
    rows.push({ title: '使用中', when: '', done: false, now: true })
  }
  return rows
})

// ── kv 字段显隐（照 STATES 表）──
const showPayNo = computed(() => !!order.value?.wx_transaction_id && state.value !== 'pending' && state.value !== 'closed')
const showAgreement = computed(() => state.value !== 'closed')
const showPeriod = computed(() => ['paid', 'fulfilled', 'refund_pending', 'refund_processing', 'refunded'].includes(state.value))

// ── 动作 ──
const busy = ref(false)
const toast = ref('')

function flash(msg: string) {
  toast.value = msg
  window.setTimeout(() => (toast.value = ''), 2200)
}

async function doCancelOrder() {
  if (!order.value) return
  busy.value = true
  try {
    await apiPayCancelOrder(order.value.order_no)
    flash('订单已取消')
    await reload()
  } catch (e) {
    flash(e instanceof Error ? e.message : '操作失败')
  } finally {
    busy.value = false
  }
}

async function doCancelRefund() {
  if (!order.value) return
  busy.value = true
  try {
    await apiPayCancelRefund(order.value.order_no)
    flash('已取消退款，恢复使用')
    window.clearInterval(timer)
    await reload()
  } catch (e) {
    flash(e instanceof Error ? e.message : '操作失败')
  } finally {
    busy.value = false
  }
}

async function copyNo() {
  const v = order.value?.wx_transaction_id || order.value?.order_no || ''
  try {
    await navigator.clipboard.writeText(v)
    flash('已复制')
  } catch {
    flash('复制失败，请手动记录')
  }
}
</script>

<template>
  <div class="order-detail-page">
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="err" class="empty">
      <div class="serif">{{ err }}</div>
      <button class="btn btn-secondary" @click="router.push('/dashboard/orders')">返回我的订单</button>
    </div>

    <template v-else-if="order">
      <div class="page-head">
        <div class="head-l">
          <button class="back" @click="router.push('/dashboard/orders')">‹ 我的订单</button>
          <h1>订单详情</h1>
        </div>
        <span :class="statusPillClass(state)">{{ statusLabel(state) }}</span>
      </div>

      <!-- 状态说明条 -->
      <div class="notice" :class="stateNoticeKind">{{ stateNotice }}</div>

      <!-- 订单信息 -->
      <div class="panel">
        <div class="panel-h">
          <span class="panel-title">订单信息</span>
          <span class="panel-no">订单号 <span class="num">{{ order.order_no }}</span></span>
        </div>
        <div class="kv">
          <span class="k">套餐</span>
          <span class="v">{{ orderTitle(snapshot) }}<template v-if="periodDaysLabel(snapshot)">（{{ periodDaysLabel(snapshot) }}）</template></span>
          <span class="k">支付金额</span>
          <span class="v num">{{ amount }}</span>
          <span class="k">下单时间</span>
          <span class="v num">{{ fmtBj(order.created_at) }}</span>
          <span class="k">支付时间</span>
          <span class="v num">{{ order.paid_at ? fmtBj(order.paid_at) : '—' }}</span>
          <template v-if="showPayNo">
            <span class="k">微信支付单号</span>
            <span class="v">
              <span class="num">{{ maskWxNo(order.wx_transaction_id || '') }}</span>
              <button class="copy" aria-label="复制完整单号" @click="copyNo">复制</button>
              <span class="mini">对账/投诉时提供给客服</span>
            </span>
          </template>
          <template v-if="showAgreement && order.agreement">
            <span class="k">协议确认</span>
            <span class="v">{{ order.agreement.version }} · {{ fmtBj(order.agreement.agreed_at) }} 已同意</span>
          </template>
          <template v-if="showPeriod">
            <span class="k">套餐时长</span>
            <span class="v">{{ periodLabel(String(snapshot?.period ?? '')) }} {{ periodDaysLabel(snapshot) }}</span>
          </template>
        </div>
      </div>

      <!-- 时间线 -->
      <div class="panel">
        <div class="panel-h"><span class="panel-title">订单流程</span></div>
        <p class="tl-desc">每个环节均记录状态变化时间（进行中环节为预计时间）；单号可在对账或投诉时提供给客服。</p>
        <div class="tl">
          <div v-for="(s, i) in steps" :key="i" class="tl-row">
            <span class="tl-mark" :class="{ done: s.done, now: s.now }" />
            <span class="tl-title">{{ s.title }}</span>
            <span class="when num">{{ s.when }}</span>
          </div>
        </div>
      </div>

      <!-- 操作区 -->
      <div class="ops">
        <template v-if="state === 'paid' || state === 'fulfilled'">
          <button class="btn btn-secondary" @click="router.push(`/dashboard/orders/${order.order_no}/refund`)">申请退款</button>
          <button class="btn btn-primary" @click="router.push('/dashboard/membership')">去我的套餐</button>
        </template>
        <template v-else-if="state === 'pending'">
          <button class="btn btn-ghost" :disabled="busy" @click="doCancelOrder">取消订单</button>
          <button class="btn btn-primary" @click="router.push('/pay')">继续支付</button>
        </template>
        <template v-else-if="state === 'refund_pending'">
          <button class="btn btn-primary" :disabled="busy" @click="doCancelRefund">取消退款</button>
        </template>
        <template v-else-if="state === 'refunded'">
          <button class="btn btn-secondary" @click="router.push('/pay')">再来一单</button>
        </template>
        <template v-else-if="state === 'closed'">
          <button class="btn btn-primary" @click="router.push('/pay')">重新下单</button>
        </template>
        <template v-else-if="state === 'exception'">
          <button class="btn btn-primary" @click="router.push('/support')">联系客服</button>
        </template>
      </div>
      <div class="tail">有疑问？<a class="lnk" href="/support" @click.prevent="router.push('/support')">联系客服</a>（请提供上方订单号）</div>

      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </template>
  </div>
</template>

<style scoped>
.order-detail-page { max-width: 720px; margin: 0 auto; position: relative; }
.page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.head-l { display: flex; align-items: baseline; gap: 14px; }
.back { border: none; background: none; color: var(--muted); cursor: pointer; font-size: 13px; padding: 0; }
.back:hover { color: var(--fg); }
.page-head h1 { font-family: var(--font-display); font-size: 26px; font-weight: 600; margin: 0; }
.loading { padding: 60px; text-align: center; color: var(--muted); }
.notice { border-radius: var(--radius-lg); padding: 12px 16px; font-size: 13.5px; margin-bottom: 16px; }
.notice.info { background: color-mix(in oklch, var(--accent, var(--fg)) 7%, var(--surface)); }
.notice.warn { background: color-mix(in oklch, orange 12%, var(--surface)); }
.notice.err { background: color-mix(in oklch, red 10%, var(--surface)); }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 18px 22px; margin-bottom: 14px; }
.panel-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.panel-title { font-family: var(--font-display); font-weight: 600; font-size: 15px; }
.panel-no { font-size: 12px; color: var(--muted); }
.kv { display: grid; grid-template-columns: 110px 1fr; row-gap: 9px; font-size: 13.5px; }
.kv .k { color: var(--muted); }
.kv .v { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.mini { font-size: 11.5px; color: var(--muted); }
.copy { border: 1px solid var(--border); background: none; border-radius: 6px; font-size: 11.5px; padding: 1px 8px; cursor: pointer; color: var(--muted); }
.copy:hover { color: var(--fg); }
.tl-desc { font-size: 12px; color: var(--muted); margin: 0 0 10px; }
.tl { display: flex; flex-direction: column; gap: 8px; }
.tl-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.tl-mark { width: 9px; height: 9px; border-radius: 50%; background: var(--border); flex: none; }
.tl-mark.done { background: var(--ok, var(--fg)); }
.tl-mark.now { background: var(--accent, var(--fg)); box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent, var(--fg)) 20%, transparent); }
.tl-title { flex: 1; }
.when { color: var(--muted); font-size: 12px; }
.ops { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
.tail { text-align: right; font-size: 12px; color: var(--muted); margin-top: 10px; }
.lnk { color: var(--accent, var(--fg)); cursor: pointer; }
.toast {
  position: fixed; left: 50%; bottom: 36px; transform: translateX(-50%);
  background: var(--fg); color: var(--surface); border-radius: 8px; padding: 8px 18px;
  font-size: 13px; z-index: 50;
}
.empty { border: 1px dashed var(--border); border-radius: var(--radius-lg); padding: 64px 32px; text-align: center; color: var(--muted); }
.empty .serif { font-family: var(--font-display); font-size: 19px; color: var(--fg); margin-bottom: 14px; }
</style>
