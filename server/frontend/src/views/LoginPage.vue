<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { apiResetPassword } from '@/api/client'
import { apiRevokeDeletion } from '@/api/web'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const username = ref('')
const password = ref('')
const errorMsg = ref('')
const redirectUrl = (route.query.redirect as string) || '/dashboard'

// ── 注销状态视图（account-deletion，US-5.2/R4）：撤销期登录被拒时的站内出口 ──
const deletionPending = ref<null | { days_left: number; deadline: string }>(null)
const accountDeleted = ref(false)
const revokeSubmitting = ref(false)
const revokeError = ref('')

async function revokeFromLoginPage() {
  if (!username.value || !password.value || revokeSubmitting.value) return
  revokeSubmitting.value = true
  revokeError.value = ''
  try {
    const res = await apiRevokeDeletion(username.value, password.value)
    if (res.code === 0) {
      // 撤销成功即恢复正常：立即重新登录进入控制台
      const loginAgain = await session.login(username.value, password.value)
      if (loginAgain.ok) router.push(redirectUrl)
      else { deletionPending.value = null; errorMsg.value = loginAgain.msg || '请重新登录' }
    } else if (res.msg?.includes('已注销')) {
      deletionPending.value = null
      accountDeleted.value = true
      revokeError.value = ''
    } else {
      revokeError.value = res.msg || '撤销失败'
    }
  } catch (e: any) {
    revokeError.value = e.message || '网络错误'
  } finally {
    revokeSubmitting.value = false
  }
}

function backToLogin() {
  deletionPending.value = null
  accountDeleted.value = false
  revokeError.value = ''
}

// 忘记密码展开
const showResetForm = ref(false)
const resetUsername = ref('')
const resetAnswer = ref('')
const resetNewPass = ref('')
const resetMsg = ref('')
const resetSubmitting = ref(false)

async function handleLogin() {
  if (!username.value || !password.value) return
  errorMsg.value = ''

  const result = await session.login(username.value, password.value)
  if (result.ok) {
    router.push(redirectUrl)
    return
  }
  // account-deletion：撤销期 → 切换到站内撤销视图；已注销 → 明确终态与出路
  if (result.deletionPending) {
    deletionPending.value = result.deletionPending
    errorMsg.value = ''
    return
  }
  if (result.accountDeleted) {
    accountDeleted.value = true
    errorMsg.value = ''
    return
  }
  errorMsg.value = result.msg || '登录失败'
}

function toggleReset() {
  showResetForm.value = !showResetForm.value
  resetMsg.value = ''
}

async function handleReset() {
  if (!resetUsername.value || !resetAnswer.value || !resetNewPass.value) return
  resetSubmitting.value = true
  resetMsg.value = ''

  try {
    const res = await apiResetPassword(resetUsername.value, resetAnswer.value, resetNewPass.value)
    if (res.code === 0) {
      // 保留展开区，让成功提示可见（用户确认后可用新密码直接登录）
      resetMsg.value = 'success:密码已重置，请用新密码登录'
      resetUsername.value = ''
      resetAnswer.value = ''
      resetNewPass.value = ''
    } else {
      resetMsg.value = res.msg || '重置失败'
    }
  } catch (e: any) {
    resetMsg.value = e.message || '网络错误'
  } finally {
    resetSubmitting.value = false
  }
}
</script>

<template>
  <div class="auth-card wide">
    <h1>登录</h1>
    <p class="sub">欢迎回来，继续你的故事</p>

    <p v-if="route.query.redirect" class="notice info">
      <Ico :d="P.info" />请先登录后继续
    </p>

    <!-- 撤销期视图（US-5.2/R4）：登录即见状态，站内出口撤销 -->
    <template v-if="deletionPending">
      <p class="notice warn">
        <Ico :d="P.alert" />
        <span><b>你的账号已申请注销</b>：剩 <b class="num">{{ deletionPending.days_left }}</b> 天（<span class="num">{{ deletionPending.deadline.slice(0, 10) }}</span> 自动执行）。撤销期内付费与套餐功能暂停，<b>你设备上的作品不受影响</b>。</span>
      </p>
      <p v-if="revokeError" class="notice err"><Ico :d="P.alert" />{{ revokeError }}</p>
      <div class="form-area">
        <AppButton variant="primary" size="lg" block :loading="revokeSubmitting" @click="revokeFromLoginPage">
          撤销注销，恢复账号
        </AppButton>
      </div>
      <div class="link-row">
        <button class="lnk" @click="backToLogin">返回登录</button>
        <router-link to="/support" class="lnk">遇到问题？联系客服</router-link>
      </div>
    </template>

    <!-- 已注销终态（US-6.2）：明确结果与出路 -->
    <template v-else-if="accountDeleted">
      <p class="notice err">
        <Ico :d="P.alert" /><span><b>该账号已注销</b>：用户名已永久封存，无法恢复登录。你设备上的作品仍完好保留。</span>
      </p>
      <div class="link-row" style="justify-content:center">
        <router-link to="/register" class="lnk">注册新账号</router-link>
        <router-link to="/support" class="lnk">联系客服</router-link>
      </div>
    </template>

    <!-- 正常登录表单 -->
    <template v-else>
    <p v-if="errorMsg" class="notice err">
      <Ico :d="P.alert" />{{ errorMsg }}
    </p>

    <div class="form-area">
      <AppInput v-model="username" label="用户名" autocomplete="username" />
      <AppInput v-model="password" type="password" label="密码" autocomplete="current-password" />

      <AppButton
        variant="primary"
        size="lg"
        block
        :loading="session.isLoading"
        :disabled="!username || !password"
        @click="handleLogin"
      >
        登录
      </AppButton>
    </div>

    <div class="link-row">
      <router-link to="/register" class="lnk">没有账号？注册</router-link>
      <button class="lnk" @click="toggleReset">忘记密码？</button>
    </div>

    <!-- 忘记密码展开区域 -->
    <div v-if="showResetForm" class="reset-area">
      <p class="reset-t serif">重置密码</p>

      <p v-if="resetMsg?.startsWith('success:')" class="notice ok">
        <Ico :d="P.check" />{{ resetMsg.slice(8) }}
      </p>
      <p v-else-if="resetMsg" class="notice err">
        <Ico :d="P.alert" />{{ resetMsg }}
      </p>

      <AppInput v-model="resetUsername" label="重置账号" autocomplete="username" />
      <AppInput v-model="resetAnswer" label="密保答案" />
      <AppInput v-model="resetNewPass" type="password" label="新密码" />

      <AppButton
        variant="primary"
        block
        size="sm"
        :loading="resetSubmitting"
        :disabled="!resetUsername || !resetAnswer || !resetNewPass"
        @click="handleReset"
      >
        重置密码
      </AppButton>
    </div>
    </template>
  </div>
</template>

<style scoped>
/* 登录卡（C端 auth-card 惯例 + S端 帐密表单扩展）：表单区左对齐。
   品牌行已删——营销壳 mkt-nav 已有 logo，同屏不重复 */
.auth-card.wide { max-width: 400px; text-align: center; }
h1 { font-family: var(--font-display); font-size: 28px; font-weight: 600; margin: 0 0 18px; }
.sub { font-size: 13.5px; color: var(--muted); margin: 4px 0 22px; }
.form-area { text-align: left; }
.form-area .btn { margin-top: 6px; }
.link-row { display: flex; justify-content: space-between; font-size: 13px; margin-top: 16px; }
.reset-area { text-align: left; border-top: 1px solid var(--border); margin-top: 18px; padding-top: 16px; }
.reset-t { font-size: 15px; font-weight: 600; margin: 0 0 12px; }
</style>
