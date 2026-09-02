<script setup lang="ts">
/**
 * 我的套餐——档位头汇总 + 订单来源套餐明细（生效中/待激活/已收回）+ 激活入口。
 * 设计事实源：docs/design-s/prototypes/membership.html
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppModal from '@/components/ui/AppModal.vue'
import { apiPayActivate, apiPayMembership, fmtBj, type MembershipGrant, type MembershipView } from '@/api/pay'

const router = useRouter()
const loading = ref(true)
const data = ref<MembershipView | null>(null)

const grants = computed<MembershipGrant[]>(() => data.value?.grants ?? [])
const isEmpty = computed(() => !!data.value && grants.value.length === 0 && data.value.remaining_sec <= 0)

const TIER_NAMES: Record<string, string> = { trial: '试用', pro: 'PRO', max: 'MAX', lifetime: '永久' }
function tierName(tier: string): string {
  return TIER_NAMES[tier] || tier
}
function durationLabel(g: MembershipGrant): string {
  return g.duration_days >= 36500 ? '永久' : `${g.duration_days} 天`
}
function statusText(status: string): string {
  return status === 'active' ? '生效中' : status === 'pending_activation' ? '待激活' : '已收回'
}
function statusPill(status: string): string {
  return status === 'active' ? 'pill-status pill-ok' : status === 'pending_activation' ? 'pill-status pill-warn' : 'pill-tag'
}

// ── 激活（确认弹层 → 接口 → 刷新；两段式第二段的用户入口）──
const confirmOpen = ref(false)
const confirmTarget = ref<MembershipGrant | null>(null)
const busy = ref(false)
const toast = ref('')
const activateErr = ref('')

function flash(msg: string) {
  toast.value = msg
  window.setTimeout(() => (toast.value = ''), 2200)
}

async function reload() {
  try {
    data.value = await apiPayMembership()
  } catch (e) {
    console.error('membership load failed:', e)
  } finally {
    loading.value = false
  }
}

function askActivate(g: MembershipGrant) {
  confirmTarget.value = g
  activateErr.value = ''
  confirmOpen.value = true
}

/** 附录 Z：激活不可激活类错误按 msg 枚举映射为用户口径 */
function activateErrText(msg: string): string {
  if (msg.includes('not_fulfilled')) return '套餐还未到货，暂不能激活'
  if (msg.includes('not_found')) return '找不到对应的套餐记录，请稍后重试'
  if (msg.includes('pending_activation')) return '该套餐当前不能激活（可能已激活或已收回）'
  return msg || '激活失败，请稍后重试'
}

async function doActivate() {
  const g = confirmTarget.value
  if (!g) return
  busy.value = true
  try {
    await apiPayActivate(g.order_no)
    confirmOpen.value = false
    confirmTarget.value = null
    flash('激活成功，套餐已开始计时')
    await reload()
  } catch (e) {
    activateErr.value = activateErrText(e instanceof Error ? e.message : '')
  } finally {
    busy.value = false
  }
}

onMounted(reload)
</script>

<template>
  <div class="membership-page">
    <div class="page-head">
      <div>
        <h1>我的套餐</h1>
        <div class="sub">已购套餐的使用情况与时长都在这里。</div>
      </div>
      <button class="btn btn-primary" @click="router.push('/pay')">续费或购买时长</button>
    </div>

    <div v-if="loading" class="loading">加载中…</div>

    <template v-else-if="data">
      <!-- 档位头（汇总含手工发放的历史权益） -->
      <div class="panel">
        <div class="panel-h">
          <div class="tier-hero">
            <span class="tier-name">{{ tierName(data.tier) }}</span>
            <span v-if="data.remaining_sec > 0" class="pill pill-ok">生效中</span>
            <span v-else class="pill pill-tag">已到期</span>
          </div>
          <span class="sum">
            <span>剩余 <b>{{ data.remaining_desc }}</b></span>
            <span v-if="data.max_expires_at">最远到期 <b>{{ data.max_expires_at.slice(0, 10) }}</b></span>
            <span v-if="data.pending_count > 0">待激活 <b>{{ data.pending_count }} 个</b></span>
          </span>
        </div>
      </div>

      <!-- 套餐明细（订单来源台账行：生效中/待激活/已收回） -->
      <div v-if="grants.length" class="panel">
        <div class="panel-h"><span class="panel-title">套餐明细</span></div>
        <div class="grant-list">
          <div v-for="g in grants" :key="g.code_id" class="grant-row" :class="{ revoked: g.status === 'revoked' }">
            <div class="g-main">
              <span class="g-tier">{{ tierName(g.tier) }} · {{ durationLabel(g) }}</span>
              <span :class="statusPill(g.status)">{{ statusText(g.status) }}</span>
            </div>
            <div class="g-sub">
              <template v-if="g.status === 'active'">已激活 {{ fmtBj(g.activated_at) }} · {{ fmtBj(g.expires_at, false) }} 到期</template>
              <template v-else-if="g.status === 'pending_activation'">已到货未激活：不计时、不占额度；未激活前退款全额</template>
              <template v-else>已随退款收回</template>
            </div>
            <button v-if="g.status === 'pending_activation'" class="btn btn-primary btn-sm" @click="askActivate(g)">激活</button>
          </div>
        </div>
      </div>

      <!-- 空态：名下无任何套餐行且无生效权益 -->
      <div v-if="isEmpty" class="empty">
        <div class="serif">还没有生效中的套餐</div>
        <p>购买套餐后，使用情况与时长明细会展示在这里。</p>
        <button class="btn btn-primary" @click="router.push('/pay')">去看看套餐</button>
      </div>
    </template>

    <!-- 激活确认：必须走 AppModal（base.css 两段式 .show 体系，手写弹窗会隐形拦截点击） -->
    <AppModal v-model:open="confirmOpen" title="确认激活套餐">
      <ul class="activate-terms">
        <li>激活后本套餐<b>立即开始计时</b></li>
        <li>此后申请退款将<b>按已使用时长折算</b>，不再全额退</li>
      </ul>
      <div v-if="activateErr" class="activate-err">
        {{ activateErr }}
        <a class="lnk" href="/support" @click.prevent="router.push('/support')">联系客服</a>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="confirmOpen = false">再想想</button>
        <button class="btn btn-primary" :disabled="busy" @click="doActivate">确认激活</button>
      </template>
    </AppModal>

    <div v-if="toast" class="toast" role="status">{{ toast }}</div>
  </div>
</template>

<style scoped>
.membership-page { max-width: 720px; margin: 0 auto; position: relative; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.page-head h1 { font-family: var(--font-display); font-size: 26px; font-weight: 600; margin: 0; }
.page-head .sub { font-size: 13px; color: var(--muted); margin-top: 6px; }
.loading { padding: 60px; text-align: center; color: var(--muted); }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px 22px; margin-bottom: 14px; }
.panel-h { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
.panel-title { font-family: var(--font-display); font-weight: 600; font-size: 15px; }
.tier-hero { display: flex; align-items: center; gap: 10px; }
.tier-name { font-family: var(--font-display); font-size: 22px; font-weight: 600; }
.sum { display: flex; gap: 16px; font-size: 12.5px; color: var(--muted); }
.sum b { color: var(--fg); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.grant-list { display: flex; flex-direction: column; }
.grant-row { display: grid; grid-template-columns: 1fr auto; gap: 4px 14px; padding: 13px 0; border-top: 1px solid var(--border); }
.grant-row:first-child { border-top: none; }
.grant-row.revoked { opacity: 0.55; }
.g-main { display: flex; align-items: center; gap: 10px; }
.g-tier { font-family: var(--font-display); font-weight: 600; font-size: 14px; }
.g-sub { grid-column: 1; font-size: 12.5px; color: var(--muted); }
.grant-row .btn { grid-row: 1 / 3; grid-column: 2; align-self: center; }
.btn-sm { padding: 5px 16px; font-size: 13px; }
.activate-terms { margin: 0 0 10px; padding-left: 18px; font-size: 13.5px; line-height: 1.9; }
.activate-err { border-radius: var(--radius-lg); background: color-mix(in oklch, red 10%, var(--surface)); padding: 10px 14px; font-size: 13px; }
.activate-err .lnk { color: var(--accent, var(--fg)); cursor: pointer; }
.empty { border: 1px dashed var(--border); border-radius: var(--radius-lg); padding: 64px 32px; text-align: center; color: var(--muted); margin-top: 14px; }
.empty .serif { font-family: var(--font-display); font-size: 19px; color: var(--fg); }
.empty p { margin: 8px 0 0; font-size: 13.5px; }
.empty .btn { margin-top: 16px; }
.toast {
  position: fixed; left: 50%; bottom: 36px; transform: translateX(-50%);
  background: var(--fg); color: var(--surface); border-radius: 8px; padding: 8px 18px;
  font-size: 13px; z-index: 50;
}
</style>
