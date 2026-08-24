<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import AppInput from '@/components/ui/AppInput.vue'
import { SECURITY_QUESTIONS } from "@/constants/security-questions"
import AppButton from '@/components/ui/AppButton.vue'
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'

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
  <div class="auth-card wide">
    <div class="head-row">
      <h1>注册</h1>
      <span class="b ok">注册即送 7 天全功能试用</span>
    </div>
    <p class="sub">几分钟完成，马上开始写作</p>

    <p v-if="errorMsg" class="strip err">
      <Ico :d="P.alert" />{{ errorMsg }}
    </p>

    <div class="form-area">
      <!-- 组 1：必填账号信息 -->
      <p class="grp-t serif">账号信息</p>
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

      <!-- 组 2：密保设置 -->
      <p class="grp-t serif">密保设置 <span class="grp-sub">· 用于找回密码</span></p>
      <div class="field">
        <select
          class="input"
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
      </div>

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

      <AppButton
        variant="primary"
        size="lg"
        block
        :loading="session.isLoading"
        :disabled="!canSubmit"
        @click="handleRegister"
      >
        注册
      </AppButton>
    </div>

    <p class="foot-lnk">
      已有账号？<router-link to="/login" class="lnk">登录</router-link>
    </p>
  </div>
</template>

<style scoped>
/* 品牌行已删——营销壳 mkt-nav 已有 logo，同屏不重复 */
.auth-card.wide { max-width: 420px; text-align: center; }
.head-row { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 18px; }
h1 { font-family: var(--font-display); font-size: 28px; font-weight: 600; margin: 0; }
.sub { font-size: 13.5px; color: var(--muted); margin: 4px 0 22px; }
.form-area { text-align: left; }
.grp-t { font-size: 15px; font-weight: 600; margin: 6px 0 10px; }
.grp-t:first-child { margin-top: 0; }
.grp-sub { font-family: var(--font-body); font-size: 12.5px; font-weight: 400; color: var(--muted); }
.form-area .btn { margin-top: 8px; }
.foot-lnk { font-size: 13px; color: var(--muted); margin: 16px 0 0; }
</style>
