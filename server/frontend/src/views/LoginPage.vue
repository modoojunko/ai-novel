<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { apiResetPassword } from '@/api/client'
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
  } else {
    errorMsg.value = result.msg || '登录失败'
  }
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
    <div class="brand-row">
      <span class="logo-mark">爱</span>
      <span class="bn serif">爱小说</span>
    </div>
    <h1>登录</h1>
    <p class="sub">欢迎回来，继续你的故事</p>

    <p v-if="route.query.redirect" class="strip info">
      <Ico :d="P.info" />请先登录后继续
    </p>
    <p v-if="errorMsg" class="strip err">
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

      <p v-if="resetMsg?.startsWith('success:')" class="strip ok">
        <Ico :d="P.check" />{{ resetMsg.slice(8) }}
      </p>
      <p v-else-if="resetMsg" class="strip err">
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
  </div>
</template>

<style scoped>
/* 登录卡（C端 auth-card 惯例 + S端 帐密表单扩展）：表单区左对齐 */
.auth-card.wide { max-width: 400px; text-align: center; }
.brand-row { display: flex; align-items: center; justify-content: center; gap: 9px; margin-bottom: 18px; }
.brand-row .bn { font-size: 17px; font-weight: 600; }
h1 { font-family: var(--font-display); font-size: 28px; font-weight: 600; margin: 0; }
.sub { font-size: 13.5px; color: var(--muted); margin: 4px 0 22px; }
.form-area { text-align: left; }
.form-area .btn { margin-top: 6px; }
.link-row { display: flex; justify-content: space-between; font-size: 13px; margin-top: 16px; }
.reset-area { text-align: left; border-top: 1px solid var(--border); margin-top: 18px; padding-top: 16px; }
.reset-t { font-size: 15px; font-weight: 600; margin: 0 0 12px; }
</style>
