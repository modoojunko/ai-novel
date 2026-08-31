<script setup lang="ts">
/**
 * 申请退款——preview → confirm 弹窗 → processing / refunded；含两拒绝态。
 * 设计事实源：docs/design-s/prototypes/refund.html
 * 冻结式口径：确认即冻结停止使用；界面不允许出现「处理期间继续使用/失败已恢复」类文案。
 */
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  apiPayOrderDetail, apiPayRefundPreview, apiPayRequestRefund,
  fenToYuan, fmtBj, orderTitle, periodDaysLabel,
  type OrderDetail, type RefundPreview,
} from '@/api/pay'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const order = ref<OrderDetail | null>(null)
const preview = ref<RefundPreview | null>(null)
const confirmOpen = ref(false)
const busy = ref(false)
const err = ref('')

// confirm 弹窗关闭后进入的状态面：processing | refunded
const phase = ref<'preview' | 'processing' | 'refunded'>('preview')
const refundFen = ref(0)

onMounted(async () => {
  const orderNo = String(route.params.orderNo)
  try {
    order.value = await apiPayOrderDetail(orderNo)
    // 已在退款流程中的订单 → 直接给终态视图（数据同源，processing 可再次进入）
    if (order.value.status === 'refund_processing') {
      refundFen.value = order.value.refund?.amount_fen ?? 0
      phase.value = 'processing'
    } else if (order.value.status === 'refunded') {
      refundFen.value = order.value.refund?.amount_fen ?? 0
      phase.value = 'refunded'
    } else {
      preview.value = await apiPayRefundPreview(orderNo)
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
})

async function doConfirm() {
  if (!order.value) return
  busy.value = true
  try {
    const res = await apiPayRequestRefund(order.value.order_no, '')
    refundFen.value = res.refund_fen
    phase.value = 'processing'
    confirmOpen.value = false
  } catch (e) {
    err.value = e instanceof Error ? e.message : '提交失败'
    confirmOpen.value = false
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="refund-page">
    <div v-if="loading" class="loading">加载中…</div>

    <template v-else-if="order">
      <!-- ═══ 态三 processing ═══ -->
      <template v-if="phase === 'processing'">
        <div class="page-head">
          <h1>退款处理中</h1>
          <span class="pill-status pill-warn">退款中</span>
        </div>
        <div class="panel center">
          <div class="done-mark warn">◔</div>
          <div class="serif">已受理，正在退回 {{ fenToYuan(refundFen) }}</div>
          <p>原路退回您的微信，一般数分钟至 3 个工作日到账；当天支付当天退，可能稍晚，款项不会丢失。</p>
          <div class="kv inline">
            <span class="k">折算基准</span><span class="v">您确认退款时</span>
            <span class="k">套餐使用</span><span class="v">已停止</span>
          </div>
          <button class="btn btn-secondary" @click="router.push('/dashboard/orders')">返回我的订单</button>
        </div>
      </template>

      <!-- ═══ 态四 refunded ═══ -->
      <template v-else-if="phase === 'refunded'">
        <div class="page-head">
          <h1>退款完成</h1>
          <span class="pill-status pill-tag">已退款</span>
        </div>
        <div class="panel center">
          <div class="done-mark ok">✓</div>
          <div class="serif">{{ fenToYuan(refundFen) }} 已原路退回</div>
          <p>{{ fmtBj(order.refunded_at || '') }} 退回微信 · 对应套餐时长已收回</p>
          <div class="kv inline">
            <span class="k">其他套餐</span><span class="v">不受影响，按原起止继续</span>
            <span class="k">套餐功能</span><span class="v">如无其他套餐，已回到免费版</span>
          </div>
          <button class="btn btn-primary" @click="router.push('/dashboard/orders')">返回我的订单</button>
        </div>
        <div class="notice info tail">需要继续使用套餐功能？随时可以重新购买套餐，时长从头计算。</div>
      </template>

      <!-- ═══ 态一 preview（默认，含两拒绝态分支） ═══ -->
      <template v-else>
        <div class="page-head">
          <button class="back" @click="router.push(`/dashboard/orders/${order.order_no}`)">‹ 返回详情</button>
          <h1>申请退款</h1>
        </div>
        <p class="sub">退款按剩余时长折算，原路退回您的微信。本操作只影响这一笔订单。</p>

        <!-- 拒绝态：不足 1 分 -->
        <template v-if="preview && !preview.refundable && preview.reason === 'below_one_fen'">
          <div class="notice err">这笔订单剩余时长已不多，折算金额不足 1 分钱，无法发起退款。</div>
          <div class="panel center">
            <div class="serif">订单即将到期，剩余时长可直接用完</div>
            <button class="btn btn-secondary" @click="router.push('/dashboard/orders')">返回我的订单</button>
          </div>
        </template>

        <!-- 拒绝态：超 1 年窗 -->
        <template v-else-if="preview && !preview.refundable && preview.reason === 'over_one_year'">
          <div class="notice err">这笔订单支付已超过 1 年，超出微信退款通道的受理窗口，无法在线退款。</div>
          <div class="panel center">
            <div class="serif">如确有特殊情况，客服会帮您看还能怎么处理</div>
            <button class="btn btn-primary" @click="router.push('/support')">联系客服</button>
          </div>
        </template>

        <!-- 其他不可退（非 fulfilled/进行中） -->
        <template v-else-if="preview && !preview.refundable">
          <div class="notice warn">当前订单状态暂不支持自助退款，可在订单详情查看进度或联系客服。</div>
          <div class="panel center">
            <button class="btn btn-secondary" @click="router.push('/dashboard/orders')">返回我的订单</button>
          </div>
        </template>

        <!-- 可退：金额预览 -->
        <template v-else-if="preview && preview.refundable">
          <div class="panel">
            <div class="panel-h">
              <span class="panel-title">{{ orderTitle(order.snapshot) }}<template v-if="periodDaysLabel(order.snapshot)"> · {{ periodDaysLabel(order.snapshot) }}</template></span>
              <span class="pill-status pill-ok">已到账</span>
            </div>
            <div class="kv">
              <span class="k">订单号</span><span class="v num">{{ order.order_no }}</span>
              <span class="k">支付时间</span><span class="v num">{{ fmtBj(order.paid_at) }}</span>
              <span class="k">实付金额</span><span class="v num">{{ fenToYuan(order.amount_fen) }}</span>
              <span class="k">剩余时长</span><span class="v">{{ preview.remaining_desc }}</span>
            </div>
            <hr>
            <div class="refund-hero">
              <span class="v num">{{ fenToYuan(preview.refund_fen ?? 0) }}</span>
              <span class="u">预计退款（原路退回）</span>
            </div>
            <p class="rule-note">按剩余时长计算退款，精确到秒，金额四舍五入到分；未激活或排队中（未消耗）的套餐退款为全额。以您点确认的这一刻为准计算剩余；确认后套餐立即停止使用。</p>
            <div class="ops-row">
              <button class="btn btn-primary lg" @click="confirmOpen = true">确认退款金额，继续</button>
              <a class="lnk" @click.prevent="router.push(`/dashboard/orders/${order.order_no}`)">先不退了</a>
            </div>
          </div>
          <div class="tail"><a class="lnk" href="/support" @click.prevent="router.push('/support')">看看退款政策全文</a></div>
        </template>
      </template>

      <!-- ═══ 态二 confirm 弹窗 ═══ -->
      <div v-if="confirmOpen" class="scrim" @click.self="!busy && (confirmOpen = false)">
        <div class="modal" role="dialog" aria-modal="true" aria-label="确认退款">
          <div class="m-title">确认退款</div>
          <div class="kv">
            <span class="k">订单号</span><span class="v num">{{ order.order_no }}</span>
            <span class="k">实付金额</span><span class="v num">{{ fenToYuan(order.amount_fen) }}</span>
            <span class="k">剩余时长</span><span class="v">{{ preview?.remaining_desc }}</span>
            <span class="k">退款金额</span><span class="v num hl">{{ fenToYuan(preview?.refund_fen ?? 0) }}</span>
          </div>
          <p class="rule-note">提交后：对应套餐立即停止使用；退款原路退回您的微信，一般数分钟至 3 个工作日到账。</p>
          <div class="m-foot">
            <button class="btn btn-secondary" :disabled="busy" @click="confirmOpen = false">再想想</button>
            <button class="btn btn-primary" :disabled="busy" @click="doConfirm">{{ busy ? '提交中…' : '确认退款' }}</button>
          </div>
        </div>
      </div>

      <div v-if="err" class="toast" role="status">{{ err }}</div>
    </template>
  </div>
</template>

<style scoped>
.refund-page { max-width: 560px; margin: 0 auto; }
.page-head { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
.page-head h1 { font-family: var(--font-display); font-size: 26px; font-weight: 600; margin: 0; }
.back { border: none; background: none; color: var(--muted); cursor: pointer; font-size: 13px; padding: 0; }
.sub { font-size: 13px; color: var(--muted); margin: 0 0 18px; }
.loading { padding: 60px; text-align: center; color: var(--muted); }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px 22px; }
.panel.center { text-align: center; padding: 44px 26px; }
.panel-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.panel-title { font-family: var(--font-display); font-weight: 600; font-size: 15px; }
.kv { display: grid; grid-template-columns: 96px 1fr; row-gap: 8px; font-size: 13.5px; }
.kv.inline { margin: 16px auto 20px; max-width: 320px; text-align: left; }
.kv .k { color: var(--muted); }
.kv .v.hl { font-weight: 600; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
hr { border: none; border-top: 1px dashed var(--border); margin: 16px 0; }
.refund-hero { display: flex; align-items: baseline; gap: 12px; }
.refund-hero .v { font-family: var(--font-display); font-size: 34px; font-weight: 600; }
.refund-hero .u { font-size: 12.5px; color: var(--muted); }
.rule-note { font-size: 12px; color: var(--muted); line-height: 1.7; margin: 12px 0 0; }
.ops-row { display: flex; align-items: center; gap: 16px; margin-top: 18px; }
.btn.lg { width: 100%; padding: 11px 0; font-size: 15px; }
.lnk { color: var(--accent, var(--fg)); cursor: pointer; font-size: 12.5px; white-space: nowrap; }
.tail { text-align: center; margin-top: 16px; }
.notice { border-radius: var(--radius-lg); padding: 12px 16px; font-size: 13.5px; margin-bottom: 14px; }
.notice.err { background: color-mix(in oklch, red 10%, var(--surface)); }
.notice.warn { background: color-mix(in oklch, orange 12%, var(--surface)); }
.notice.info { background: color-mix(in oklch, var(--accent, var(--fg)) 7%, var(--surface)); }
.notice.tail { margin-top: 14px; text-align: center; }
.done-mark { font-size: 40px; line-height: 1; margin-bottom: 12px; }
.done-mark.ok { color: var(--ok, #1a7f37); }
.done-mark.warn { color: var(--warn, #b45309); }
.serif { font-family: var(--font-display); font-size: 20px; font-weight: 600; }
.panel.center p { font-size: 13px; color: var(--muted); margin: 10px 0 0; }
.panel.center .btn { margin-top: 20px; }
/* 弹窗 */
.scrim { position: fixed; inset: 0; background: #0006; display: flex; align-items: center; justify-content: center; z-index: 60; }
.modal { background: var(--surface); border-radius: var(--radius-lg); padding: 22px 24px; width: min(420px, calc(100vw - 48px)); }
.m-title { font-family: var(--font-display); font-weight: 600; font-size: 16px; margin-bottom: 14px; }
.m-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.toast { position: fixed; left: 50%; bottom: 36px; transform: translateX(-50%); background: var(--fg); color: var(--surface); border-radius: 8px; padding: 8px 18px; font-size: 13px; z-index: 70; }
</style>
