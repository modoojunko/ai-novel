<script setup lang="ts">
/**
 * 账户设置页（account-settings IA + account-blocks-unify 统一口径）：
 * 块 → 行 → 弹层——账号信息只读卡 + 安全块展示行（修改密码/密保设置/退出登录）
 * + 主题面板 + 危险区（注销入口，隔离行、安静不诱导）。
 * 页面本体零裸表单：修改密码/密保均为弹层编辑；
 * 撤销期态：warn 状态行 + 撤销注销（密码弹层，免 JWT——用户名+密码即身份证明）。
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
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
const router = useRouter()

// ── 安全行（行+弹层口径）──
const pwOpen = ref(false)
const secOpen = ref(false)
const secStatusText = computed(() =>
  session.securityQuestion ? `已设置：${session.securityQuestion}` : '未设置——忘记密码时将无法自助验证身份',
)

function handleLogout() {
  session.logout()
  router.push('/')
}

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
      <!-- 账号信息卡（IA·B2 只读）：身份信息全量落点；无套餐状态行（D1：套餐 OWN 套餐页） -->
      <AppCard compact>
        <div class="panel-h"><h2>账号信息</h2></div>
        <div class="kv">
          <span>用户名</span><b class="num">{{ session.username }}</b>
          <span>注册时间</span><b class="num">{{ session.registeredAt || '—' }}</b>
        </div>
        <p class="rule-note" style="margin-top: 8px">
          本站账号只由「用户名 + 密码」组成，没有绑定邮箱或手机号。<b>请牢记你的密码</b>——忘记密码可在登录页「忘记密码找回」恢复。
        </p>
      </AppCard>

      <!-- 安全（IA·B3 行+弹层统一）：行 = 标题 + 当前状态 + 动词按钮，表单只在弹层里 -->
      <AppCard compact>
        <div class="panel-h"><h2>安全</h2></div>
        <div class="set-rows">
          <div class="set-row">
            <div>
              <div class="t">修改密码</div>
              <div class="d">定期更换，客户端与网页端同时生效</div>
            </div>
            <AppButton variant="secondary" size="sm" @click="pwOpen = true">修改密码</AppButton>
          </div>
          <div class="set-row">
            <div>
              <div class="t">密保设置</div>
              <div class="d">{{ secStatusText }}</div>
            </div>
            <AppButton variant="secondary" size="sm" @click="secOpen = true">
              {{ session.securityQuestion ? '修改密保' : '设置密保' }}
            </AppButton>
          </div>
          <div class="set-row">
            <div>
              <div class="t">退出登录</div>
              <div class="d">仅退出当前浏览器会话，不影响其他设备</div>
            </div>
            <a class="lnk" @click.prevent="handleLogout">退出登录</a>
          </div>
        </div>
      </AppCard>

      <!-- 界面主题（IA·B3b 偏好）：即点即存，不设编辑档 -->
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

    <!-- 修改密码弹层（行入口 → 弹层编辑） -->
    <ChangePasswordForm v-model:open="pwOpen" />

    <!-- 密保设置弹层（行入口 → 弹层编辑，答案永不回显） -->
    <SecurityForm v-model:open="secOpen" />

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

/* 危险区（B4，GitHub Danger Zone 模式）：红发丝线框恢复视觉一致，
   描边按钮 = 唯一警示色（安静不诱导）；48px 间距与上方常规项拉开隔离距离 */
.danger-zone { margin-top: 28px; }
.dz-label { font-family: var(--font-display); font-size: 12px; font-weight: 600; letter-spacing: 0.08em; color: var(--err); margin: 0 0 8px; }
.dz-box { border-color: color-mix(in oklch, var(--err) 35%, var(--border)); }
.dz-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.dz-t { font-size: 13.5px; font-weight: 500; }
.dz-d { font-size: 12.5px; color: var(--muted); margin-top: 2px; max-width: 380px; }
/* AppButton variant=error 是实心 btn-danger；入口档用描边覆盖（实心保留给向导内最终确认） */
.btn-outline-danger { background: var(--surface); color: var(--err); border: 1px solid color-mix(in oklch, var(--err) 45%, var(--border)); white-space: nowrap; }
.btn-outline-danger:hover:not(:disabled) { background: var(--err-soft); border-color: var(--err); }
</style>
