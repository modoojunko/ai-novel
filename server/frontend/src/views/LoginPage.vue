<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { apiResetPassword } from '@/api/client'
import AppCard from '@/components/ui/AppCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'

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
      resetMsg.value = 'success:密码已重置，请用新密码登录'
      resetUsername.value = ''
      resetAnswer.value = ''
      resetNewPass.value = ''
      showResetForm.value = false
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
  <div class="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
    <AppCard class="max-w-sm w-full">
      <h1 class="font-display text-2xl font-bold">登录</h1>
      <p class="text-sm text-base-content/60 mt-1 mb-6">欢迎回来，继续你的故事</p>

      <p v-if="route.query.redirect" class="alert alert-info text-sm mb-4">请先登录后继续</p>
      <p v-if="errorMsg" class="alert alert-error text-sm mb-4">{{ errorMsg }}</p>

      <div class="space-y-4">
        <AppInput v-model="username" label="用户名" />
        <AppInput v-model="password" type="password" label="密码" />

        <AppButton
          variant="primary"
          block
          :loading="session.isLoading"
          :disabled="!username || !password"
          @click="handleLogin"
        >
          登录
        </AppButton>
      </div>

      <div class="flex justify-between text-sm mt-4">
        <router-link to="/register" class="link link-primary">没有账号？注册</router-link>
        <button class="link link-hover" @click="toggleReset">忘记密码？</button>
      </div>

      <!-- 忘记密码展开区域 -->
      <div v-if="showResetForm" class="collapse collapse-open mt-4 border-t border-base-300 pt-4 space-y-4">
        <p class="text-sm font-medium">重置密码</p>

        <p v-if="resetMsg?.startsWith('success:')" class="alert alert-success text-sm">
          {{ resetMsg.slice(8) }}
        </p>
        <p v-else-if="resetMsg" class="alert alert-error text-sm">{{ resetMsg }}</p>

        <AppInput v-model="resetUsername" label="用户名" />
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
    </AppCard>
  </div>
</template>
