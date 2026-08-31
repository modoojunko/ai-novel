<script setup lang="ts">
/**
 * 账户设置页（account-deletion 改版，IA：account-settings-design.md）：
 * 身份 + 安全（改密码/密保/主题）+ 危险区（注销入口，隔离行、安静不诱导）。
 * 撤销期态：warn 状态行 + 撤销注销（密码弹层，免 JWT——用户名+密码即身份证明）。
 */
import { computed, ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { usePageLoad } from '@/composables/usePageLoad'
import { useToast } from '@/composables/useToast'
import { apiDeletionStatus, apiRevokeDeletion } from '@/api/web'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppModal from '@/components/ui/AppModal.vue'
import DeletionWizard from '@/components/dashboard/DeletionWizard.vue'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton.vue'
import ChangePasswordForm from '@/components/dashboard/ChangePasswordForm.vue'
import SecurityForm from '@/components/dashboard/SecurityForm.vue'
import ThemeForm from '@/components/dashboard/ThemeForm.vue'
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'

const session = useSessionStore()
const toast = useToast()
// none→中性、trial→warn、付费→ok（与 appbar 徽标同口径）
const tierCls = computed(() => {
  if (session.tier === 'none') return ''
  if (session.tier === 'trial') return 'pill-warn'
  return 'pill-ok'
})

// ── 注销状态（R7）──
const deletionPending = ref(false)
const deletionDaysLeft = ref(0)
const deletionDeadline = ref('')
const wizardOpen = ref(false)

async function refreshDeletionStatus() {
  try {
    const res = await apiDeletionStatus()
    if (res.code === 0 && res.data) {
      deletionPending.value = !!res.data.pending
      deletionDaysLeft.value = res.data.days_left ?? 0
      deletionDeadline.value = (res.data.deadline || '').slice(0, 10)
    }
  } catch {
    /* 状态查询失败不打扰主流程：危险区仍在，可重进 */
  }
}

const { loadError, retry } = usePageLoad(async () => {
  if (!session.userFetched) {
    await session.fetchUserInfo()
  }
  await refreshDeletionStatus()
})

// ── 注销向导 ──
function onWizardSubmitted(deadline: string) {
  deletionPending.value = true
  deletionDaysLeft.value = 15
  deletionDeadline.value = deadline.slice(0, 10)
  toast.info('注销申请已提交，15 天撤销期内可撤销')
}

// ── 撤销注销（撤销期用户登录被拒无 JWT 的场景走登录页；此处为会话未过期的站内撤销）──
const revokeOpen = ref(false)
const revokePassword = ref('')
const revokeSubmitting = ref(false)
const revokeError = ref('')

async function submitRevoke() {
  if (!revokePassword.value || revokeSubmitting.value) return
  revokeSubmitting.value = true
  revokeError.value = ''
  try {
    const res = await apiRevokeDeletion(session.username, revokePassword.value)
    if (res.code === 0) {
      revokeOpen.value = false
      revokePassword.value = ''
      deletionPending.value = false
      toast.success('已撤销注销，账号恢复正常')
    } else {
      revokeError.value = res.msg || '撤销失败'
    }
  } catch (e: any) {
    revokeError.value = e.message || '网络错误'
  } finally {
    revokeSubmitting.value = false
  }
}
</script>

<template>
  <div class="page-col narrow">
    <div class="page-head">
      <div>
        <h1>账户设置</h1>
        <p class="sub">管理登录凭据与密保</p>
      </div>
      <AppButton v-if="deletionPending" variant="primary" size="sm" @click="revokeOpen = true">
        撤销注销
      </AppButton>
    </div>

    <!-- 撤销期状态行（US-5.2，响度跟随任务：此刻用户唯一要做的是决定去留） -->
    <p v-if="deletionPending" class="notice warn" role="status">
      <Ico :d="P.alert" />
      <span><b>你的账号已申请注销</b>：剩 <b class="num">{{ deletionDaysLeft }}</b> 天（<span class="num">{{ deletionDeadline }}</span> 自动执行）。撤销期内付费与套餐功能暂停，本地作品不受影响。</span>
    </p>

    <LoadingSkeleton v-if="session.isLoading && !loadError" variant="form" />

    <div v-else-if="loadError" class="err-box">
      <p>加载失败</p>
      <AppButton variant="secondary" size="sm" @click="retry">重试</AppButton>
    </div>

    <template v-else>
      <!-- 用户信息卡（只读） -->
      <AppCard compact>
        <div class="who-row">
          <div class="avatar serif">{{ (session.username || '?')[0] }}</div>
          <div>
            <div class="who-name">{{ session.username }}</div>
            <div class="who-meta">
              <span class="pill pill-status" :class="tierCls">{{ session.tierDisplay }}</span>
              <span v-if="session.expiresAt" class="exp num">
                到期：{{ session.expiresAt.slice(0, 10) }}
              </span>
            </div>
          </div>
        </div>
      </AppCard>

      <!-- 安全 -->
      <ChangePasswordForm />

      <!-- 密保设置 -->
      <SecurityForm />

      <!-- 界面主题 -->
      <ThemeForm />

      <!-- 危险区（B4）：独立容器 + 红发丝线框；链接/描边 = 唯一警示色，安静不诱导 -->
      <section class="danger-zone" aria-label="危险区">
        <h2 class="dz-label">危险区</h2>
        <AppCard compact class="dz-box">
          <div class="dz-row">
            <div>
              <div class="dz-t">注销账号…</div>
              <div class="dz-d">注销后无法再登录，用户名永久封存；提交后有 15 天撤销期，到期自动执行；你设备上的作品不受影响。</div>
            </div>
            <AppButton variant="error" class="btn-outline-danger" @click="wizardOpen = true">
              注销账号…
            </AppButton>
          </div>
        </AppCard>
      </section>
    </template>

    <!-- 注销向导弹层（三步 + 受理态） -->
    <DeletionWizard v-model:open="wizardOpen" :username="session.username" @submitted="onWizardSubmitted" />

    <!-- 撤销密码弹层（撤销与申请同密码强度，US-4.1） -->
    <AppModal :open="revokeOpen" title="撤销注销" @update:open="revokeOpen = $event">
      <p class="notice info" style="margin-bottom:12px">
        <Ico :d="P.info" /><span>验证密码后账号将<b>立即恢复正常</b>，撤销不产生任何费用。</span>
      </p>
      <p v-if="revokeError" class="notice err"><Ico :d="P.alert" />{{ revokeError }}</p>
      <AppInput v-model="revokePassword" type="password" label="登录密码" autocomplete="current-password" />
      <template #footer>
        <AppButton variant="secondary" @click="revokeOpen = false">取消</AppButton>
        <AppButton variant="primary" :loading="revokeSubmitting" :disabled="!revokePassword" @click="submitRevoke">
          确认撤销
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.page-col { display: flex; flex-direction: column; gap: 20px; }
.narrow { max-width: 640px; }
.page-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.err-box { text-align: center; padding: 48px 0; color: var(--muted); display: flex; flex-direction: column; align-items: center; gap: 12px; }
.who-row { display: flex; align-items: center; gap: 14px; }
.avatar { width: 44px; height: 44px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-strong); font-size: 19px; font-weight: 600; display: grid; place-items: center; }
.who-name { font-weight: 500; }
.who-meta { display: flex; align-items: center; gap: 10px; margin-top: 5px; }
.exp { font-size: 12px; color: var(--muted); }

/* 危险区（B4，GitHub Danger Zone 模式）：红发丝线框恢复视觉一致，
   描边按钮 = 唯一警示色（安静不诱导）；48px 间距与上方常规项拉开隔离距离 */
.danger-zone { margin-top: 28px; }
.dz-label { font-family: var(--font-display); font-size: 12px; font-weight: 600; letter-spacing: 0.08em; color: var(--err); margin: 0 0 8px; }
.dz-box { border-color: color-mix(in oklch, var(--err) 35%, var(--border)); }
.dz-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.dz-t { font-size: 13.5px; font-weight: 500; }
.dz-d { font-size: 12.5px; color: var(--muted); margin-top: 2px; max-width: 380px; }
/* AppButton variant=error 是实心 btn-danger；入口档用描边覆盖（实心保留给向导内最终确认） */
.btn-outline-danger { background: var(--surface); color: var(--err); border: 1px solid color-mix(in oklch, var(--err) 45%, var(--border)); }
.btn-outline-danger:hover:not(:disabled) { background: var(--err-soft); border-color: var(--err); }
</style>
