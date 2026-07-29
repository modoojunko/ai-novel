<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { apiAuthorize } from '@/api/client'
import { useSessionStore } from '@/stores/session'
import AppCard from '@/components/ui/AppCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'

const route = useRoute()
const session = useSessionStore()

const pcHash = ref('')
const deviceProfile = ref('')
const username = ref('')
const password = ref('')
const isSubmitting = ref(false)
const authorized = ref(false)
const errorMsg = ref('')
const authResult = ref<{ tier: string; expires_at: string }>({ tier: '', expires_at: '' })
const isInvalid = ref(false)

onMounted(() => {
  pcHash.value = (route.query.pc_hash as string) || ''
  deviceProfile.value = (route.query.device_profile as string) || ''
  if (!pcHash.value) {
    isInvalid.value = true
  }
})

async function submitAuth() {
  if (!username.value || !password.value) return
  isSubmitting.value = true
  errorMsg.value = ''

  try {
    const res = await apiAuthorize(
      username.value,
      password.value,
      pcHash.value,
      undefined,
      deviceProfile.value || undefined,
    )
    if (res.code === 0) {
      authorized.value = true
      authResult.value = {
        tier: res.data?.tier || '',
        expires_at: res.data?.expires_at || '',
      }
    } else {
      errorMsg.value = res.msg || '授权失败'
    }
  } catch (e: any) {
    if (e.message?.includes('429') || e.message?.includes('过于频繁')) {
      errorMsg.value = '操作过于频繁，请 1 分钟后重试'
    } else {
      errorMsg.value = e.message || '网络错误'
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <AppCard class="max-w-sm w-full">
    <!-- 无效请求 -->
    <template v-if="isInvalid">
      <div class="alert alert-warning">无效的授权请求，请从桌面应用重新发起</div>
    </template>

    <!-- 授权成功 -->
    <template v-else-if="authorized">
      <div class="text-center py-4">
        <svg class="w-16 h-16 text-success mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h1 class="font-display text-xl font-bold">授权成功</h1>
        <p class="text-sm text-base-content/60 mt-2">
          套餐：{{ authResult.tier }}
          <template v-if="authResult.expires_at">
            · 到期：{{ authResult.expires_at.slice(0, 10) }}
          </template>
        </p>
        <p class="text-xs text-base-content/50 mt-6">此页面可以关闭了</p>
      </div>
    </template>

    <!-- 授权表单 -->
    <template v-else>
      <div class="flex items-center gap-2 mb-4">
        <span class="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-brand to-amber-deep flex items-center justify-center text-white text-sm">✎</span>
        <h1 class="font-display text-xl font-bold">设备授权</h1>
      </div>
      <p class="text-sm text-base-content/60 mb-6">
        桌面应用请求绑定此设备，请登录以完成授权
      </p>

      <p v-if="errorMsg" class="alert alert-error text-sm mb-4">{{ errorMsg }}</p>

      <div class="space-y-4">
        <AppInput v-model="username" label="用户名" />
        <AppInput v-model="password" type="password" label="密码" />

        <AppButton
          variant="primary"
          block
          :loading="isSubmitting"
          :disabled="!username || !password"
          @click="submitAuth"
        >
          授权登录
        </AppButton>
      </div>

      <p class="text-center mt-6">
        <router-link to="/register" class="link link-primary text-sm">还没有账号？注册</router-link>
      </p>
    </template>
  </AppCard>
</template>
