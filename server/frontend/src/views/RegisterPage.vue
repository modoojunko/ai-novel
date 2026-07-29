<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import AppCard from '@/components/ui/AppCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { SECURITY_QUESTIONS } from "@/constants/security-questions"
import AppButton from '@/components/ui/AppButton.vue'

const router = useRouter()
const session = useSessionStore()

const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const securityQuestion = ref('')
const securityAnswer = ref('')
const errorMsg = ref('')

const passwordError = computed(() => {
  if (password.value && password.value.length < 6) return '密码至少 6 位'
  return ''
})

const confirmError = computed(() => {
  if (!confirmPassword.value) return ''
  if (confirmPassword.value !== password.value) return '两次密码不一致'
  return ''
})

const canSubmit = computed(() => {
  return username.value
    && password.value.length >= 6
    && confirmPassword.value === password.value
    && securityQuestion.value
    && securityAnswer.value
    && !session.isLoading
})

const questionOptions = SECURITY_QUESTIONS

const showCustomInput = ref(false)

function onQuestionChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  securityQuestion.value = val
  showCustomInput.value = val === '__custom__'
}

const customQuestion = ref('')

async function handleRegister() {
  if (!canSubmit.value) return
  errorMsg.value = ''

  const question = showCustomInput.value ? customQuestion.value : securityQuestion.value
  const result = await session.register(username.value, password.value, question, securityAnswer.value)
  if (result.ok) {
    router.push('/dashboard')
  } else {
    errorMsg.value = result.msg || '注册失败'
  }
}
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
    <AppCard class="max-w-md w-full">
      <div class="flex items-center gap-2 mb-1">
        <h1 class="font-display text-2xl font-bold">注册</h1>
        <span class="badge badge-success badge-outline">注册即送 7 天全功能试用</span>
      </div>

      <p v-if="errorMsg" class="alert alert-error text-sm mb-4">{{ errorMsg }}</p>

      <div class="space-y-4">
        <!-- 组 1：必填账号信息 -->
        <fieldset class="fieldset">
          <legend class="fieldset-legend">账号信息</legend>
          <AppInput v-model="username" label="用户名" autocomplete="username" />
          <AppInput
            v-model="password"
            type="password"
            label="密码"
            autocomplete="new-password"
            :error="passwordError"
            hint="至少 6 位"
          />
          <AppInput
            v-model="confirmPassword"
            type="password"
            label="确认密码"
            :error="confirmError"
          />
        </fieldset>

        <div class="divider" />

        <!-- 组 2：密保设置 -->
        <fieldset class="fieldset">
          <legend class="fieldset-legend">密保设置 · 用于找回密码</legend>
          <select
            class="select select-bordered w-full"
            :value="securityQuestion"
            @change="onQuestionChange"
          >
            <option
              v-for="opt in questionOptions"
              :key="opt.value"
              :value="opt.value"
              :disabled="opt.disabled"
            >
              {{ opt.label }}
            </option>
          </select>

          <AppInput
            v-if="showCustomInput"
            v-model="customQuestion"
            label="自定义问题"
            placeholder="输入你的密保问题"
          />

          <AppInput
            v-model="securityAnswer"
            label="密保答案"
            placeholder="请输入答案"
          />
        </fieldset>

        <AppButton
          variant="primary"
          block
          :loading="session.isLoading"
          :disabled="!canSubmit"
          @click="handleRegister"
        >
          注册
        </AppButton>
      </div>

      <p class="text-center text-sm mt-4">
        已有账号？
        <router-link to="/login" class="link link-primary">登录</router-link>
      </p>
    </AppCard>
  </div>
</template>
