<script setup lang="ts">
/**
 * 修改密码弹层（account-blocks-unify：安全动作=行+弹层，页面本体零裸表单；
 * IA §5 S1 口径落地）。受控组件：open 由账户页安全行按钮驱动；
 * 成功 → toast + 关弹层 + 清空；失败 → 弹层内报错，不关弹层可重试。
 */
import { ref, computed, watch } from 'vue'
import { apiChangePassword } from '@/api/web'
import { useToast } from '@/composables/useToast'
import AppModal from '@/components/ui/AppModal.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const toast = useToast()

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const isSubmitting = ref(false)
const errorMsg = ref('')

const passwordError = computed(() => {
  if (newPassword.value && newPassword.value.length < 6) return '密码至少 6 位'
  if (newPassword.value && oldPassword.value && newPassword.value === oldPassword.value) return '新密码不能与旧密码相同'
  return ''
})

const confirmError = computed(() => {
  if (!confirmPassword.value) return ''
  if (confirmPassword.value !== newPassword.value) return '两次密码不一致'
  return ''
})

const canSubmit = computed(() => {
  return oldPassword.value
    && newPassword.value.length >= 6
    && confirmPassword.value === newPassword.value
    && newPassword.value !== oldPassword.value
    && !isSubmitting.value
})

// 每次打开重置为干净态（旧密码不残留，错误不跨会话）
watch(() => props.open, (val) => {
  if (!val) return
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  errorMsg.value = ''
  isSubmitting.value = false
})

function close() {
  emit('update:open', false)
}

async function submit() {
  if (!canSubmit.value) return
  isSubmitting.value = true
  errorMsg.value = ''
  try {
    await apiChangePassword(oldPassword.value, newPassword.value)
    toast.success('密码已修改')
    close()
  } catch (e: any) {
    errorMsg.value = e.message || '修改失败'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <AppModal :open="open" title="修改密码" @update:open="emit('update:open', $event)">
    <p v-if="errorMsg" class="notice err">
      <Ico :d="P.alert" />{{ errorMsg }}
    </p>

    <div class="space-y-4">
      <AppInput v-model="oldPassword" type="password" label="当前密码" autocomplete="current-password" />
      <AppInput
        v-model="newPassword"
        type="password"
        label="新密码"
        autocomplete="new-password"
        :error="passwordError"
        hint="至少 6 位"
      />
      <AppInput
        v-model="confirmPassword"
        type="password"
        label="确认新密码"
        autocomplete="new-password"
        :error="confirmError"
      />
    </div>

    <template #footer>
      <AppButton variant="secondary" @click="close">取消</AppButton>
      <AppButton :disabled="!canSubmit" :loading="isSubmitting" @click="submit">确认修改</AppButton>
    </template>
  </AppModal>
</template>
