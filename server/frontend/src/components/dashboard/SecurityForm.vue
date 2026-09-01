<script setup lang="ts">
/**
 * 密保设置弹层（account-blocks-unify：行+弹层口径；与修改密码弹层同构）。
 * 答案哈希存储、界面永不回显——表单只有"新答案"一个答案字段；
 * 打开时预选当前问题（自定义问题回填），成功 → 更新 session 行状态 + toast + 关弹层。
 */
import { ref, watch, computed } from 'vue'
import { apiSetSecurity } from '@/api/web'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'
import AppModal from '@/components/ui/AppModal.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { SECURITY_QUESTIONS } from '@/constants/security-questions'
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const toast = useToast()
const session = useSessionStore()

const CUSTOM = '__custom__'
const questionOptions = SECURITY_QUESTIONS

const securityQuestion = ref('')
const customQuestion = ref('')
const securityAnswer = ref('')
const isSubmitting = ref(false)
const errorMsg = ref('')
const showCustomInput = computed(() => securityQuestion.value === CUSTOM)

// 每次打开重置 + 预选当前问题：预设直接选中；自定义问题回填到自定义输入框
watch(() => props.open, (val) => {
  if (!val) return
  errorMsg.value = ''
  isSubmitting.value = false
  securityAnswer.value = ''
  customQuestion.value = ''
  const cur = session.securityQuestion
  const preset = questionOptions.some((o) => o.value === cur && o.value !== '' && o.value !== CUSTOM)
  securityQuestion.value = preset ? cur : (cur ? CUSTOM : '')
  if (cur && !preset) customQuestion.value = cur
})

function onQuestionChange(e: Event) {
  securityQuestion.value = (e.target as HTMLSelectElement).value
}

const canSubmit = computed(() => {
  const q = showCustomInput.value ? customQuestion.value.trim() : securityQuestion.value
  return !!q && !!securityAnswer.value.trim() && !isSubmitting.value
})

function close() {
  emit('update:open', false)
}

async function submit() {
  if (!canSubmit.value) return
  isSubmitting.value = true
  errorMsg.value = ''
  const question = showCustomInput.value ? customQuestion.value.trim() : securityQuestion.value
  try {
    await apiSetSecurity(question, securityAnswer.value.trim())
    session.securityQuestion = question
    toast.success('密保已更新')
    close()
  } catch (e: any) {
    errorMsg.value = e.message || '设置失败'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <AppModal :open="open" title="密保设置" @update:open="emit('update:open', $event)">
    <p class="rule-note" style="margin: 0 0 12px">
      密保用于忘记密码时验证身份。答案加密保存、不再显示；保存新密保会覆盖旧密保。
    </p>

    <p v-if="errorMsg" class="notice err">
      <Ico :d="P.alert" />{{ errorMsg }}
    </p>

    <div class="field">
      <label>密保问题</label>
      <select
        class="input"
        :value="securityQuestion"
        :disabled="isSubmitting"
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
      autocomplete="off"
    />

    <AppInput
      v-model="securityAnswer"
      label="密保答案"
      placeholder="输入新答案，保存后覆盖旧答案"
      autocomplete="off"
    />

    <template #footer>
      <AppButton variant="secondary" @click="close">取消</AppButton>
      <AppButton :disabled="!canSubmit" :loading="isSubmitting" @click="submit">保存</AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
/* scoped：全局 .rule-note 会漏染 pay 页同名 scoped 类（review P2），组件内自治 */
.rule-note { font-size: 12.5px; color: var(--muted); line-height: 1.7; }
.field { display: grid; gap: 6px; margin-bottom: 14px; }
.field label { font-size: 12.5px; color: var(--muted); }
</style>
