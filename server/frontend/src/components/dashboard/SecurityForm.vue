<script setup lang="ts">
import { ref } from 'vue'
import { apiSetSecurity } from '@/api/web'
import { useToast } from '@/composables/useToast'
import AppCard from '@/components/ui/AppCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { SECURITY_QUESTIONS } from "@/constants/security-questions"
import AppButton from '@/components/ui/AppButton.vue'
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'

const toast = useToast()

const questionOptions = SECURITY_QUESTIONS

const securityQuestion = ref('')
const customQuestion = ref('')
const securityAnswer = ref('')
const isSubmitting = ref(false)
const successMsg = ref('')
const errorMsg = ref('')

const showCustomInput = ref(false)

function onQuestionChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  securityQuestion.value = val
  showCustomInput.value = val === '__custom__'
}

function canSubmit() {
  const q = showCustomInput.value ? customQuestion.value : securityQuestion.value
  return q && securityAnswer.value && !isSubmitting.value
}

async function submit() {
  if (!canSubmit()) return
  isSubmitting.value = true
  errorMsg.value = ''
  successMsg.value = ''

  const question = showCustomInput.value ? customQuestion.value : securityQuestion.value

  try {
    await apiSetSecurity(question, securityAnswer.value)
    successMsg.value = '密保设置成功'
    toast.success('密保设置成功')
  } catch (e: any) {
    errorMsg.value = e.message || '设置失败'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <AppCard>
    <div class="panel-h"><h2>密保设置</h2></div>
    <p class="fm-sub">
      用于忘记密码时找回账号，设置新密保会覆盖旧的。
    </p>

    <p v-if="errorMsg" class="strip err">
      <Ico :d="P.alert" />{{ errorMsg }}
    </p>
    <p v-if="successMsg" class="strip ok">
      <Ico :d="P.check" />{{ successMsg }}
    </p>

    <div>
      <div class="field">
        <label>密保问题</label>
        <select
          class="input"
          :value="securityQuestion"
          @change="onQuestionChange"
          :disabled="isSubmitting"
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

      <div class="foot-row">
        <AppButton :disabled="!canSubmit()" :loading="isSubmitting" @click="submit">
          保存
        </AppButton>
      </div>
    </div>
  </AppCard>
</template>

<style scoped>
.fm-sub { font-size: 13px; color: var(--muted); margin: -4px 0 14px; line-height: 1.7; }
.foot-row { display: flex; justify-content: flex-end; }
</style>
