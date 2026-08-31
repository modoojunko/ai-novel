<script setup lang="ts">
/**
 * 注销向导（account-deletion，tasks 4.1）：弹层三步 + 受理态。
 * 步骤：后果告知（info）→ 权益处置（有未消耗权益时：去退款出口 / 显式勾选放弃）
 * → 密码确认（含「已导出备份」必勾声明）。提交受理后进入 15 天撤销期，
 * 撤销期内的撤销走登录页（本组件不承载）。
 * 服务器是权益状态的唯一事实源：向导内每次前进都以服务端响应为准。
 */
import { ref, computed, watch } from 'vue'
import {
  apiDeletionAssets,
  apiDeletionStatus,
  apiRequestAssetRefund,
  apiRequestDeletion,
  type BlockedAsset,
} from '@/api/web'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'

const props = defineProps<{ open: boolean; username: string }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  /** 受理成功：携带到期执行时刻，父级刷新注销状态 */
  submitted: [deadline: string]
}>()

type Step = 'consequences' | 'assets' | 'password' | 'submitted'

const step = ref<Step>('consequences')
const assets = ref<BlockedAsset[]>([])
const waive = ref(false)
const exportConfirmed = ref(false)
const password = ref('')
const submitting = ref(false)
const errorMsg = ref('')
const submittedDeadline = ref('')

const hasAssets = computed(() => assets.value.length > 0)
const canSubmit = computed(() => exportConfirmed.value && !!password.value && !submitting.value)

// 权益级行内状态：pending（未处理）→ refund_requested（退款申请已提交，客服人工执行）/ waived（放弃）
const rowStates = ref<Record<string, 'pending' | 'refund_requested' | 'waived'>>({})
const refundBusy = ref('')
const rowState = (codeId: string) => rowStates.value[codeId] ?? 'pending'
const canProceedAssets = computed(() => assets.value.every((a) => rowState(a.code_id) !== 'pending'))
const pendingCount = computed(() => assets.value.filter((a) => rowState(a.code_id) === 'pending').length)

async function requestRefund(a: BlockedAsset) {
  if (refundBusy.value) return
  refundBusy.value = a.code_id
  errorMsg.value = ''
  try {
    const res = await apiRequestAssetRefund(a.code_id)
    if (res.code === 0) {
      rowStates.value = { ...rowStates.value, [a.code_id]: 'refund_requested' }
    } else {
      errorMsg.value = res.msg || '提交失败'
    }
  } catch (e: any) {
    errorMsg.value = e.message || '网络错误'
  } finally {
    refundBusy.value = ''
  }
}

// 档位/状态的人话口径（与 session.tierDisplay、LicenseCard 同源约定）
const TIER_NAMES: Record<string, string> = {
  lifetime: "永久会员",
  yearly: "年付会员",
  quarterly: "季付会员",
  monthly: "月付会员",
  trial: "7 天免费试用",
}
const STATUS_NAMES: Record<string, string> = {
  unused: "待激活（尚未开始计时）",
  active: "生效中",
}
const tierName = (t: string) => TIER_NAMES[t] ?? t
const statusName = (s: string) => STATUS_NAMES[s] ?? s

/** 权益行摘要：lifetime 不伪造到期日；已过期的如实标注 */
const assetSummary = (a: BlockedAsset) => {
  if (a.tier === "lifetime") return "永久有效"
  const expired = a.expires_at ? new Date(a.expires_at) < new Date() : false
  const base = a.duration_days ? `${a.duration_days} 天` : ""
  return expired ? `${base}（已过期）`.trim() : base
}

function close() {
  emit('update:open', false)
}

watch(() => props.open, async (val) => {
  if (!val) return
  // 每次打开复位：权益状态以服务端为准（离开去退款的用户重进时复验自动通过）
  step.value = 'consequences'
  assets.value = []
  rowStates.value = {}
  waive.value = false
  exportConfirmed.value = false
  password.value = ''
  submitting.value = false
  errorMsg.value = ''
  submittedDeadline.value = ''
  try {
    const res = await apiDeletionAssets()
    assets.value = res.data?.blocked_assets ?? []
    if (!assets.value.length) step.value = 'password' // 无未消耗权益：跳过处置步
  } catch {
    step.value = 'consequences' // 查询失败仍在告知步重试
  }
})

function nextFromConsequences() {
  errorMsg.value = ''
  step.value = hasAssets.value ? 'assets' : 'password'
}

function nextFromAssets() {
  // 放弃勾选后进入密码确认（服务端受理时仍会复验权益状态）
  errorMsg.value = ''
  step.value = 'password'
}

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  errorMsg.value = ''
  try {
    const res = await apiRequestDeletion(password.value, waive.value)
    if (res.code === 0) {
      submittedDeadline.value = res.data?.deadline || ''
      step.value = 'submitted'
      emit('submitted', submittedDeadline.value)
    } else {
      errorMsg.value = res.msg || '提交失败'
    }
  } catch (e: any) {
    // 拦截器 reject：code 3 = 权益未处置（附真实清单）→ 回处置步；其余展示错误
    if (e?.code === 3 && e?.data?.blocked_assets) {
      assets.value = e.data.blocked_assets
      waive.value = false
      step.value = 'assets'
      errorMsg.value = e.message || '存在未消耗的套餐权益，请先处理'
    } else {
      errorMsg.value = e.message || '提交失败'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AppModal :open="open" title="注销账号" @update:open="emit('update:open', $event)">
    <!-- 步骤 1：后果告知（R3/R5/R6） -->
    <div v-if="step === 'consequences'">
      <p class="notice warn">
        <Ico :d="P.alert" /><span><b>永久注销本账号：15 天撤销期内可撤销，到期自动执行</b>。注销后用户名永久封存、无法找回；<b>你设备上的作品不受影响</b>；交易记录依法留存。提交前需处理未消耗的套餐权益。</span>
      </p>

      <div class="fx-title">这些会失去</div>
      <div class="fx-list">
        <div class="fx lose"><Ico :d="P.close" /><span>账号凭据失效，客户端退出到登录页；<b>用户名永久封存</b>，不再释放注册。</span></div>
        <div class="fx lose"><Ico :d="P.close" /><span>全部设备绑定解除，套餐功能终止。</span></div>
      </div>

      <div class="fx-title" style="margin-top:14px">这些不受影响 / 依法处理</div>
      <div class="fx-list">
        <div class="fx keep"><Ico :d="P.check" /><span><b>本地作品不受影响</b>：你的作品只保存在你自己的设备上，本站没有副本——注销<b>不会删除任何作品</b>。</span></div>
        <div class="notice warn" style="margin:12px 0 0">
          <Ico :d="P.alert" />
          <span><b>建议提前备份作品</b>：作品仅存于这台设备，请注销前<b>将你的小说文档导出并自行妥善保存</b>——日后卸载应用、清理数据或更换设备都可能导致作品无法找回，本站没有副本、无法替你恢复。</span>
        </div>
        <div class="fx keep"><Ico :d="P.check" /><span><b>交易记录依法留存约 10 年</b>：订单与支付记录按法律要求保留金额与时间，但会<b>抹去与你身份的关联</b>，不再日常展示。</span></div>
      </div>

      <p v-if="errorMsg" class="notice err" style="margin-top:12px"><Ico :d="P.alert" />{{ errorMsg }}</p>
    </div>

    <!-- 步骤 2：权益处置（R2，无未消耗权益时跳过）。每项权益独立处置：
         [申请退款]（客服人工处理）或 [放弃]（不退款随注销作废）。全部处置完毕才能继续。 -->
    <div v-else-if="step === 'assets'">
      <p class="notice warn">
        <Ico :d="P.alert" /><span>你有 <b>{{ assets.length }} 项未消耗的套餐权益</b>。注销<b>不会自动退还它们</b>——每一项都需要你单独确认处理方式：</span>
      </p>
      <div class="asset-list">
        <div v-for="a in assets" :key="a.code_id" class="asset-row">
          <span class="pill pill-status pill-warn">{{ tierName(a.tier) }}</span>
          <span class="asset-meta">{{ assetSummary(a) }}</span>
          <span class="asset-action">
            <AppButton
              v-if="rowState(a.code_id) !== 'refund_requested' && rowState(a.code_id) !== 'waived'"
              variant="secondary" size="sm" :disabled="refundBusy === a.code_id"
              @click="requestRefund(a)"
            >
              申请退款
            </AppButton>
            <span v-else-if="rowState(a.code_id) === 'refund_requested'" class="pill pill-status pill-warn">退款处理中</span>
            <span v-else class="pill pill-status">已放弃</span>
          </span>
        </div>
      </div>

      <div class="choice-block" style="margin-top:12px">
        <div class="choice-h">不想逐项等待退款？</div>
        <div class="choice-d">勾选即<b>放弃全部尚未申请退款的权益</b>（作废且不产生任何退款，不可恢复），注销立即可继续。</div>
        <label class="chk">
          <input v-model="waive" type="checkbox" />
          <span>放弃其余全部未申请退款的权益，直接继续注销。</span>
        </label>
      </div>

      <p v-if="errorMsg" class="notice err" style="margin-top:12px"><Ico :d="P.alert" />{{ errorMsg }}</p>
    </div>

    <!-- 步骤 3：密码确认（R3 + 导出备份必勾声明） -->
    <div v-else-if="step === 'password'">
      <label class="chk" style="margin:4px 0 12px">
        <input v-model="exportConfirmed" type="checkbox" />
        <span>我已将小说文档<b>导出并自行妥善保存</b>（作品仅存于这台设备，注销后请自行保管好备份文件）。</span>
      </label>

      <div class="kv" style="margin-bottom:12px">
        <span>账号</span><b class="num">{{ username }}</b>
        <span>撤销期</span><b>15 天 · 到期自动执行</b>
      </div>

      <p class="notice warn">
        <Ico :d="P.alert" /><span>提交后立即进入 <b>15</b> 天撤销期，到期未撤销将自动执行注销。<b>撤销也需要验证密码</b>，请务必牢记。</span>
      </p>
      <p v-if="errorMsg" class="notice err"><Ico :d="P.alert" />{{ errorMsg }}</p>

      <AppInput v-model="password" type="password" label="登录密码" autocomplete="current-password"
        hint="密码仅用于本次确认。本站没有你的邮箱与手机号，不会通过邮件或短信联系你。" />
    </div>

    <!-- 受理态（R4）：倒计时开始，非庆祝 -->
    <div v-else>
      <p class="notice warn">
        <Ico :d="P.alert" /><span><b>注销申请已提交</b>：15 天撤销期内可随时撤销，<span class="num">{{ submittedDeadline.slice(0, 10) }}</span> 到期未撤销将自动执行。</span>
      </p>
      <p class="notice info">
        <Ico :d="P.info" /><span>撤销期内付费与套餐功能暂停；<b>你设备上的作品不受影响</b>。撤销方式：退出后重新登录，按提示验证密码即可撤销。</span>
      </p>
    </div>

    <template #footer>
      <template v-if="step === 'consequences'">
        <AppButton variant="secondary" @click="close">再想想</AppButton>
        <AppButton variant="error" @click="nextFromConsequences">我已了解，继续</AppButton>
      </template>
      <template v-else-if="step === 'assets'">
        <span v-if="!canProceedAssets" class="foot-hint">请先为每项权益选择处理方式（申请退款或放弃）</span>
        <AppButton variant="error" :disabled="!canProceedAssets" @click="nextFromAssets">放弃并继续</AppButton>
      </template>
      <template v-else-if="step === 'password'">
        <AppButton variant="secondary" @click="close">上一步</AppButton>
        <AppButton variant="error" :disabled="!canSubmit" :loading="submitting" @click="submit">
          确认申请注销
        </AppButton>
      </template>
      <template v-else>
        <AppButton variant="secondary" @click="close">知道了</AppButton>
      </template>
    </template>
  </AppModal>
</template>

<style scoped>
/* 后果清单（原型 .fx 同款）：图标 14px 约束必须显式给出——
   Ico 未传 size 时 SVG 无宽高属性会撑到默认 300×150（评审反馈的巨叉巨勾） */
.fx-title { font-size: 12.5px; font-weight: 600; color: var(--muted); }
.fx-list { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.fx { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; line-height: 1.55; }
.fx :deep(svg) { width: 14px; height: 14px; flex: none; margin-top: 2px; }
.fx.lose { color: var(--err); }
.fx.lose :deep(svg) { color: var(--err); }
.fx.keep { color: var(--ink); }
.chk { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; line-height: 1.55; color: var(--warn); cursor: pointer; }
.chk input { margin-top: 2px; accent-color: var(--warn); width: 14px; height: 14px; flex: none; }
.kv { display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; font-size: 12.5px; text-align: left; }
.kv span { color: var(--muted); }
.kv b { font-weight: 500; }
.asset-list { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.asset-row { display: flex; align-items: center; gap: 10px; font-size: 12.5px; }
.asset-action { margin-left: auto; flex: none; }
.foot-hint { font-size: 12px; color: var(--muted); }
.choice-block { border: 1px solid var(--border); border-radius: 9px; padding: 12px 14px; margin-top: 10px; }
.choice-h { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.choice-h .num { color: var(--err); margin-right: 4px; }
.choice-d { font-size: 12.5px; color: var(--muted); line-height: 1.55; margin-bottom: 10px; }
</style>
