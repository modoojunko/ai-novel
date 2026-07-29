<script setup lang="ts">
import { ref } from 'vue'
import { apiSetSecurity } from '@/api/web'
import { useToast } from '@/composables/useToast'
import AppCard from '@/components/ui/AppCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { SECURITY_QUESTIONS } from "@/constants/security-questions"
import AppButton from '@/components/ui/AppButton.vue'

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
    <h3 class="font-display text-lg font-bold mb-4">密保设置</h3>
    <p class="text-sm text-base-content/60 mb-4">
      用于忘记密码时找回账号，设置新密保会覆盖旧的。
    </p>

    <p v-if="errorMsg" class="alert alert-error text-sm mb-4">{{ errorMsg }}</p>
    <p v-if="successMsg" class="alert alert-success text-sm mb-4">{{ successMsg }}</p>

    <div class="space-y-4">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">密保问题</legend>
        <select
          class="select select-bordered w-full"
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
      </fieldset>

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

      <div class="flex justify-end">
        <AppButton :disabled="!canSubmit()" :loading="isSubmitting" @click="submit">
          保存
        </AppButton>
      </div>
    </div>
  </AppCard>
</template>
