<script setup lang="ts">
/**
 * 收银台——购买流程页（无控制台外壳）。
 * 选套餐、协议弹窗、扫码支付、八态分支。
 * 设计事实源：docs/design-s/prototypes/cashier.html（选型 A）
 */
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  apiPaySkus, apiPayCreateOrder, apiPayQueryOrder, apiPayCancelOrder,
  fenToYuan, fenToYuanShort, periodLabel,
  type SkusView, type SkuItem, type CreateOrderResult,
} from '@/api/pay'
import Ico from '@/components/ui/Ico.vue'
import AppModal from '@/components/ui/AppModal.vue'
import SiteBeianBar from '@/components/site/SiteBeianBar.vue'
import { P } from '@/components/ui/icons'

const router = useRouter()

// ── 状态 ──
const loading = ref(true)
const skusData = ref<SkusView | null>(null)
const selectedSku = ref<SkuItem | null>(null)
const order = ref<CreateOrderResult | null>(null)
const payState = ref<'pick' | 'waiting' | 'success' | 'closed' | 'failCreate' | 'failVerify' | 'waitFail'>('pick')
const showTerms = ref(false)
const termsRead = ref(false)
const countdownSec = ref(0)
const queryHint = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null

// ── 计算属性 ──
const selectedPrice = computed(() => {
  if (!selectedSku.value) return ''
  return fenToYuan(selectedSku.value.price_fen)
})

// 协议确认在「去支付」后的弹窗里打钩留痕（产品拍板），选卡本身不设门槛
const canPay = computed(() => !!selectedSku.value)

// ── 方法 ──
function selectSku(sku: SkuItem) {
  selectedSku.value = sku
}

async function loadSkus() {
  try {
    skusData.value = await apiPaySkus()
    // 默认选 popular 或第一个
    const popular = skusData.value.skus.find(s => s.sku_key === skusData.value?.popular_sku)
    selectedSku.value = popular || skusData.value.skus[0] || null
  } catch (e) {
    console.error('loadSkus failed:', e)
  } finally {
    loading.value = false
  }
}

async function goPay() {
  if (!selectedSku.value || !skusData.value) return
  showTerms.value = true
  termsRead.value = false
}

async function confirmPay() {
  showTerms.value = false
  if (!selectedSku.value || !skusData.value) return
  try {
    order.value = await apiPayCreateOrder(
      selectedSku.value.sku_key,
      skusData.value.agreement_version,
    )
    payState.value = 'waiting'
    startPolling()
    startCountdown(order.value.ttl_seconds)
    } catch (e: any) {
      if (e?.code === 4012) {
        // 开关未开放
        payState.value = 'pick'
        return
      }
      payState.value = 'failCreate'
    }
}

function startPolling() {
  stopPolling()
  let count = 0
  pollTimer = setInterval(async () => {
    if (!order.value) return
    count++
    // 3s 起步，20 轮后 5s，80 轮后 10s
    const interval = count <= 20 ? 3000 : count <= 80 ? 5000 : 10000
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = setInterval(() => pollTick(), interval)
    // 立即执行一次
    await pollTick()
  }, 3000)
}

async function pollTick() {
  if (!order.value) return
  try {
    const r = await apiPayQueryOrder(order.value.order_no)
    if (r.hint === 'SUCCESS') {
      stopPolling()
      stopCountdown()
      payState.value = 'success'
    } else if (r.hint === 'CLOSED') {
      stopPolling()
      stopCountdown()
      payState.value = 'closed'
    } else if (r.hint === 'PAYERROR') {
      queryHint.value = 'payerror'
    } else if (r.hint === 'NOTPAY') {
      queryHint.value = 'notpay'
    }
  } catch {
    // 网络错误静默重试
  }
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

function startCountdown(seconds: number) {
  stopCountdown()
  countdownSec.value = seconds
  countdownTimer = setInterval(() => {
    countdownSec.value--
    if (countdownSec.value <= 0) {
      stopCountdown()
      payState.value = 'closed'
    }
  }, 1000)
}

function stopCountdown() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
}

async function cancelOrder() {
  if (!order.value) return
  try {
    await apiPayCancelOrder(order.value.order_no)
  } catch { /* 静默 */ }
  stopPolling()
  stopCountdown()
  payState.value = 'pick'
  order.value = null
}

async function manualQuery() {
  if (!order.value) return
  try {
    const r = await apiPayQueryOrder(order.value.order_no)
    if (r.hint === 'SUCCESS') {
      stopPolling(); stopCountdown()
      payState.value = 'success'
    } else if (r.hint === 'PAYERROR') {
      payState.value = 'waitFail'
      queryHint.value = 'payerror'
    } else if (r.hint === 'NOTPAY') {
      queryHint.value = 'notpay'
    }
  } catch { /* 静默 */ }
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── 二维码本地渲染（安全红线）──
// code_url 即支付凭证，官方指引明示「调用第三方库生成二维码」——本地 canvas
// 绘制，禁止外发给第三方二维码服务（可被记录/篡改换码）
import QRCode from 'qrcode'

const qrCanvas = ref<HTMLCanvasElement | null>(null)

async function renderQr(): Promise<void> {
  // 先等 DOM：watcher 默认 pre-flush（渲染前触发），此时 waiting 分支的 canvas 尚未挂载，
  // 守卫必须放在 nextTick 之后（否则 qrCanvas 恒为 null，二维码永远画不出来）
  await nextTick()
  const url = order.value?.code_url
  if (!url || !qrCanvas.value) return
  try {
    await QRCode.toCanvas(qrCanvas.value, url, { width: 180, margin: 1 })
  } catch { /* 渲染失败保留占位提示 */ }
}

watch(() => [payState.value, order.value?.code_url], () => { void renderQr() }, { flush: 'post' })

// ── 生命周期 ──
onMounted(loadSkus)
onUnmounted(() => { stopPolling(); stopCountdown() })
</script>

<template>
  <div class="pay-page">
    <!-- 品牌 -->
    <div class="pay-brand">
      <span class="logo-mark">爱</span>
      <span class="pay-brand-name">爱小说</span>
    </div>

    <!-- ═══ 态〇：未登录 ═══ -->
    <template v-if="payState === 'pick' && !skusData?.purchase_enabled && skusData">
      <div class="pay-stage">
        <h1>登录后继续购买</h1>
        <p class="pay-sub">您选择的套餐已保留</p>
        <div class="pay-card">
          <button class="btn btn-primary btn-block" @click="router.push('/login')">
            去登录
          </button>
          <p class="pay-hint">
            还没有账号？<router-link to="/register" class="lnk">注册即送 7 天全功能试用</router-link>
          </p>
        </div>
      </div>
    </template>

    <!-- ═══ 态一：选套餐 ═══ -->
    <template v-else-if="payState === 'pick'">
      <h1 class="pay-h1">升级套餐，解锁全部写作能力</h1>
      <p class="pay-sub">一次性买断 · 到期不自动扣款 · 随时按剩余时长退款</p>

      <!-- 档位 tab（仅多档位时显示） -->
      <div v-if="skusData && skusData.tiers.filter(t => t.is_live).length > 1" class="pay-tabs">
        <button
          v-for="t in skusData.tiers.filter(t => t.is_live)"
          :key="t.key"
          class="pay-tab"
          :class="{ on: selectedSku?.tier_key === t.key }"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- 套餐卡 -->
      <div v-if="loading" class="pay-loading">加载中…</div>
      <div v-else-if="skusData" class="pay-cards">
        <!-- 免费卡 -->
        <div class="pay-card-free">
          <span class="pill pill-tag">当前方案</span>
          <div class="pay-card-name">免费</div>
          <div class="pay-card-days">1 台设备</div>
          <div class="pay-card-price">¥0</div>
          <div class="pay-card-feat">
            <i>全部基础写作工具</i>
            <i>不含 AI 能力</i>
            <i>本地作品永久保留</i>
          </div>
        </div>

        <!-- 付费 SKU 卡 -->
        <div
          v-for="sku in skusData.skus"
          :key="sku.sku_key"
          class="pay-card"
          :class="{ on: selectedSku?.sku_key === sku.sku_key, popular: sku.sku_key === skusData.popular_sku }"
          @click="selectSku(sku)"
        >
          <span v-if="sku.sku_key === skusData.popular_sku" class="pill pill-accent pay-card-badge">最受欢迎</span>
          <div class="pay-card-name">{{ periodLabel(sku.period) }}</div>
          <div class="pay-card-days">{{ sku.period_days }} 天 · {{ sku.device_limit }} 台设备</div>
          <div class="pay-card-price">
            {{ fenToYuanShort(sku.price_fen) }}<small>元</small>
          </div>
          <div v-if="sku.discount_display" class="pay-card-off">{{ sku.discount_display }}</div>
          <div class="pay-card-feat">
            <i>含免费全部功能</i>
            <i>AI 生成正文（流式）</i>
            <i>设定与章纲融入 AI</i>
          </div>
        </div>
      </div>

      <!-- 协议 + 购买条 -->
      <div v-if="selectedSku" class="pay-purchase">
        <div class="pay-purchase-info">
          <div class="pay-purchase-label">已选</div>
          <div class="pay-purchase-name">
            {{ periodLabel(selectedSku.period) }}（{{ selectedSku.period_days }} 天）
          </div>
        </div>
        <div class="pay-purchase-price">
          <div v-if="selectedSku.discount_display" class="pay-purchase-save">
            已省 {{ fenToYuanShort(selectedSku.base_price_fen - selectedSku.price_fen) }}
          </div>
          <div class="pay-purchase-amount">{{ selectedPrice }}</div>
        </div>
        <button class="btn btn-primary btn-lg" :disabled="!canPay" @click="goPay">
          去支付
        </button>
      </div>
      <div v-if="selectedSku" class="pay-agree-hint">
        点击去支付后，将确认<a class="lnk" @click.prevent="showTerms = true">《付费须知》</a>与<a class="lnk" @click.prevent="showTerms = true">《退款政策》</a>要点
      </div>
    </template>

    <!-- ═══ 态二：等待支付 ═══ -->
    <template v-else-if="payState === 'waiting' && order">
      <h1 class="pay-h1">微信扫码支付</h1>
      <p class="pay-sub">订单号 <span class="num">{{ order.order_no }}</span></p>
      <div class="pay-qr-card">
        <div class="notice info pay-notice">
          <span>请使用微信扫描二维码完成支付。<b>{{ selectedPrice }}</b> 支付成功后套餐立即到货。</span>
        </div>
        <div class="pay-qr-box">
          <canvas v-show="order.code_url" ref="qrCanvas" aria-label="微信支付二维码"></canvas>
          <div v-if="!order.code_url" class="pay-qr-placeholder">二维码生成中…</div>
        </div>
        <div class="pay-countdown">二维码有效期剩 <span class="num">{{ formatCountdown(countdownSec) }}</span></div>
        <button class="btn btn-ghost" @click="cancelOrder">取消支付</button>
      </div>
      <p class="pay-query-hint">
        <template v-if="queryHint === 'notpay'">查过了：微信侧<b>尚未收到这笔订单的付款</b>——刚付款请等几秒再点一次；未付款则继续扫码。</template>
        <template v-else>已扫码付款但页面没变化？<a class="lnk" @click.prevent="manualQuery">我已支付，帮我查一下到账</a></template>
      </p>
    </template>

    <!-- ═══ 态二·子：查单失败反馈 ═══ -->
    <template v-else-if="payState === 'waitFail' && order">
      <h1 class="pay-h1">微信扫码支付</h1>
      <div class="pay-qr-card">
        <div class="notice warn pay-notice">
          <span>查过了：微信显示<b>本次支付未成功</b>（如余额不足、银行卡限额，或您取消了支付）。<b>二维码仍然有效</b>——请重新扫码，或在手机上更换支付方式后重试。</span>
        </div>
        <button class="btn btn-primary" @click="payState = 'waiting'">返回重试</button>
      </div>
    </template>

    <!-- ═══ 态三：已到货 ═══ -->
    <template v-else-if="payState === 'success'">
      <h1 class="pay-h1">支付成功</h1>
      <div class="pay-card pay-success-card">
        <div class="pay-success-mark"><Ico :d="P.check" :size="26" /></div>
        <div class="pay-success-title">已到货，待激活</div>
        <div class="pay-success-hint">点「立即激活」马上开始计时；先存着也随时可在「我的套餐」激活</div>
        <div class="pay-success-actions">
          <button class="btn btn-primary" @click="router.push('/dashboard/membership')">立即激活</button>
          <button class="btn btn-secondary" @click="router.push('/dashboard')">返回控制台</button>
        </div>
      </div>
    </template>

    <!-- ═══ 态四：已过期 ═══ -->
    <template v-else-if="payState === 'closed'">
      <h1 class="pay-h1">订单已过期</h1>
      <div class="pay-card">
        <div class="notice warn pay-notice">
          <span>本次订单未支付成功，没有产生扣款。重新下单将按<b>当前价格</b>生成新订单。</span>
        </div>
        <button class="btn btn-primary btn-block" @click="payState = 'pick'; order = null">重新下单</button>
      </div>
    </template>

    <!-- ═══ 态五：下单失败 ═══ -->
    <template v-else-if="payState === 'failCreate'">
      <h1 class="pay-h1">订单创建失败</h1>
      <div class="pay-card">
        <div class="notice err pay-notice">
          <span>网络波动或支付服务暂时不可用，本次未能生成支付二维码。<b>没有产生扣款</b>，请重试。</span>
        </div>
        <div class="pay-success-actions">
          <button class="btn btn-primary" @click="payState = 'pick'">重试</button>
        </div>
      </div>
    </template>

    <!-- ═══ 协议确认弹窗 ═══ -->
    <!-- 必须走 AppModal：base.css 对 .scrim/.mcard 是两段式 .show 进出场（默认 opacity:0），
         手写 v-if 弹窗不带 .show 会整体隐形，且 fixed 遮罩仍拦截点击 → 页面假死 -->
    <AppModal v-model:open="showTerms" title="确认购买">
      <ul class="pay-terms">
        <li>一次性买断时长，<b>到期不自动扣款</b></li>
        <li>套餐支付成功即到货，<b>点激活才开始计时</b>；未激活可全额退</li>
        <li>退款<b>按剩余时长计算、原路退回</b>，不影响其他套餐</li>
        <li>本单：<b>{{ selectedSku ? `${periodLabel(selectedSku.period)}（${selectedSku.period_days} 天）· ${selectedPrice}` : '' }}</b></li>
      </ul>
      <p class="pay-terms-full">
        全文：<a class="lnk" href="/legal/payment-notice.html" target="_blank" rel="noopener">《付费须知》</a><template v-if="skusData?.agreement_version">（{{ skusData.agreement_version }}）</template>
        ·
        <a class="lnk" href="/legal/refund-policy.html" target="_blank" rel="noopener">《退款政策》</a><template v-if="skusData?.agreement_version">（{{ skusData.agreement_version }}）</template>
      </p>
      <label class="pay-agree">
        <input v-model="termsRead" type="checkbox" />
        <span>我已阅读并同意<a class="lnk" href="/legal/payment-notice.html" target="_blank" rel="noopener" @click.stop>《付费须知》</a>与<a class="lnk" href="/legal/refund-policy.html" target="_blank" rel="noopener" @click.stop>《退款政策》</a>：按剩余时长折算退款、原路退回</span>
      </label>
      <template #footer>
        <button class="btn btn-secondary" @click="showTerms = false">再想想</button>
        <button class="btn btn-primary" :disabled="!termsRead" @click="confirmPay">阅读并同意，去支付</button>
      </template>
    </AppModal>

    <!-- 全站备案条：购买页独立布局的法律文件兜底入口（弹窗之外也能到达四份全文） -->
    <SiteBeianBar class="pay-beian" />
  </div>
</template>

<style scoped>
/* 布局类（令牌走 base.css var）——对应原型 cashier.html 选型 A */
.pay-page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 48px 24px 0; background: var(--bg); }
.pay-beian { margin-top: auto; width: 100%; }
.pay-brand { display: flex; align-items: center; gap: 9px; font-family: var(--font-display); font-size: 17px; font-weight: 600; }
.logo-mark { width: 28px; height: 28px; border-radius: 8px; background: var(--accent); color: var(--on-accent); display: grid; place-items: center; font-family: var(--font-display); font-size: 15px; }
.pay-brand-name { color: var(--fg); }
.pay-h1 { font-size: 24px; font-weight: 700; letter-spacing: 0.01em; margin: 30px 0 6px; text-align: center; color: var(--fg); }
.pay-sub { font-size: 13px; color: var(--muted); margin: 0 0 26px; text-align: center; }
.pay-stage { width: 100%; max-width: 460px; margin-top: 20px; }
.pay-loading { padding: 60px; text-align: center; color: var(--muted); }

.pay-tabs { display: inline-flex; background: var(--fg-soft); border-radius: 12px; padding: 4px; gap: 4px; margin-bottom: 10px; }
.pay-tab { height: 42px; padding: 0 26px; border-radius: 9px; font-size: 14.5px; font-weight: 600; color: var(--muted); border: 0; background: none; cursor: pointer; }
.pay-tab.on { background: var(--surface); color: var(--fg); box-shadow: 0 1px 3px color-mix(in oklch, var(--fg) 10%, transparent); }

.pay-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; width: 860px; max-width: 100%; margin-top: 26px; }
.pay-card-free, .pay-card { position: relative; background: var(--surface); border: 1.5px solid var(--border); border-radius: 14px; padding: 20px 20px 18px; text-align: left; }
.pay-card { cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease; }
.pay-card:hover { border-color: color-mix(in oklch, var(--accent) 40%, var(--border)); }
.pay-card.on { border-color: var(--accent); background: color-mix(in oklch, var(--accent) 4%, var(--surface)); box-shadow: 0 0 0 3px var(--accent-soft); }
.pay-card-free { cursor: default; }
.pay-card-free:hover { border-color: var(--border); }
.pay-card-badge { position: absolute; top: -11px; left: 16px; }
.pay-card-name { font-size: 15px; font-weight: 600; color: var(--fg); }
.pay-card-days { font-size: 12px; color: var(--muted); margin-top: 2px; }
.pay-card-price { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 32px; font-weight: 600; letter-spacing: -0.02em; margin-top: 12px; color: var(--fg); }
.pay-card-price small { font-size: 13px; font-weight: 400; color: var(--muted); margin-left: 2px; }
.pay-card-off { display: inline-block; font-size: 11px; font-weight: 600; color: var(--accent-strong); background: var(--accent-soft); padding: 2px 8px; border-radius: 999px; margin-top: 4px; }
.pay-card-feat { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); display: grid; gap: 4px; }
.pay-card-feat i { font-style: normal; font-size: 11.5px; color: var(--muted); display: flex; gap: 6px; align-items: baseline; }
.pay-card-feat i::before { content: ''; flex: none; width: 4px; height: 4px; border-radius: 50%; background: var(--accent); }

.pay-purchase { width: 860px; max-width: 100%; margin-top: 18px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px 20px; display: flex; align-items: center; gap: 18px; }
.pay-purchase-info { flex: 1; }
.pay-purchase-label { font-size: 13px; color: var(--muted); }
.pay-purchase-name { font-size: 15px; font-weight: 600; }
.pay-purchase-price { text-align: right; }
.pay-purchase-save { font-size: 12px; color: var(--warn); font-weight: 500; }
.pay-purchase-amount { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 26px; font-weight: 600; }
.pay-agree-hint { width: 860px; max-width: 100%; margin-top: 12px; font-size: 12px; color: var(--muted); text-align: center; }

.pay-qr-card { width: 460px; max-width: 100%; }
.pay-notice { margin-bottom: 14px; }
.pay-qr-box { width: 188px; height: 188px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); display: grid; place-items: center; overflow: hidden; margin: 0 auto; }
.pay-qr-box img { width: 100%; height: 100%; object-fit: contain; }
.pay-qr-placeholder { font-size: 13px; color: var(--muted); }
.pay-countdown { font-size: 13px; color: var(--muted); text-align: center; margin-top: 14px; }
.pay-countdown .num { font-size: 17px; font-weight: 600; color: var(--fg); }
.pay-query-hint { text-align: center; font-size: 13px; color: var(--muted); margin-top: 14px; }

.pay-success-card { display: grid; justify-items: center; gap: 6px; padding: 28px 22px; text-align: center; }
.pay-success-mark { width: 54px; height: 54px; border-radius: 50%; background: var(--ok-soft); display: grid; place-items: center; color: var(--ok); font-size: 24px; }
.pay-success-title { font-family: var(--font-display); font-size: 21px; font-weight: 600; }
.pay-success-hint { font-size: 13px; color: var(--muted); }
.pay-success-actions { display: flex; gap: 10px; margin-top: 10px; }

.pay-terms { margin: 8px 0; padding-left: 18px; display: grid; gap: 5px; font-size: 12.5px; color: var(--muted); list-style: none; }
.pay-terms li::before { content: ''; display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: var(--accent); margin-right: 6px; vertical-align: middle; }
.pay-terms b { color: var(--fg); }
.pay-terms-full { margin: 10px 0 0; font-size: 12px; color: var(--muted); }
.pay-agree { display: flex; gap: 8px; align-items: flex-start; margin: 12px 0 0; font-size: 12.5px; color: var(--fg); cursor: pointer; }
.pay-agree input { margin-top: 3px; accent-color: var(--accent); width: 14px; height: 14px; flex: none; }

/* 响应式 */
@media (max-width: 768px) {
  .pay-cards { grid-template-columns: repeat(2, 1fr); }
  .pay-purchase { flex-direction: column; align-items: stretch; text-align: center; }
  .pay-purchase-info, .pay-purchase-price { text-align: center; }
}
</style>
