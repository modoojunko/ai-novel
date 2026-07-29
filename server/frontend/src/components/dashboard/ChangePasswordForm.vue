<script setup lang="ts">
import { ref, computed } from 'vue'
import { apiChangePassword } from '@/api/web'
import { useToast } from '@/composables/useToast'
import AppCard from '@/components/ui/AppCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'

const toast = useToast()

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const isSubmitting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

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

async function submit() {
  if (!canSubmit.value) return
  isSubmitting.value = true
  errorMsg.value = ''
  successMsg.value = ''

  try {
    await apiChangePassword(oldPassword.value, newPassword.value)
    successMsg.value = '密码已修改'
    toast.success('密码已修改')
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e: any) {
    errorMsg.value = e.message || '修改失败'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <AppCard>
    <h3 class="font-display text-lg font-bold mb-4">修改密码</h3>

    <p v-if="errorMsg" class="alert alert-error text-sm mb-4">{{ errorMsg }}</p>
    <p v-if="successMsg" class="alert alert-success text-sm mb-4">{{ successMsg }}</p>

    <div class="space-y-4">
      <AppInput v-model="oldPassword" type="password" label="旧密码" autocomplete="current-password" />
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

      <div class="flex justify-end">
        <AppButton :disabled="!canSubmit" :loading="isSubmitting" @click="submit">
          保存
        </AppButton>
      </div>
    </div>
  </AppCard>
</template>
