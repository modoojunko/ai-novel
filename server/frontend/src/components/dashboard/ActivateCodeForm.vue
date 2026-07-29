<script setup lang="ts">
import { ref } from 'vue'
import { apiActivateCode } from '@/api/web'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'

const session = useSessionStore()
const toast = useToast()

const code = ref('')
const isSubmitting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

async function submit() {
  if (!code.value.trim()) return
  isSubmitting.value = true
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const res = await apiActivateCode(code.value.trim().toUpperCase())
    if (res.code === 0) {
      successMsg.value = `激活成功！新到期日：${res.data?.new_expires_at?.slice(0, 10) || '永久'}`
      toast.success('激活成功')
      // 停留 1.5s 后刷新
      setTimeout(() => {
        session.fetchUserInfo()
        code.value = ''
      }, 1500)
    } else {
      errorMsg.value = res.msg || '激活失败'
    }
  } catch (e: any) {
    errorMsg.value = e.message || '网络错误'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <p v-if="successMsg" class="alert alert-success">{{ successMsg }}</p>
    <p v-else-if="errorMsg" class="alert alert-error">{{ errorMsg }}</p>

    <AppInput
      v-model="code"
      label="激活码"
      placeholder="AC-XXXX-XXXX-XXXX-XXXX"
      :disabled="isSubmitting || !!successMsg"
    />

    <AppButton
      v-if="!successMsg"
      variant="primary"
      block
      :loading="isSubmitting"
      :disabled="!code.trim()"
      @click="submit"
    >
      确认激活
    </AppButton>
  </div>
</template>
