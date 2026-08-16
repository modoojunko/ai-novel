<script setup lang="ts">
import { useSessionStore } from '@/stores/session'
import { usePageLoad } from '@/composables/usePageLoad'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton.vue'
import ChangePasswordForm from '@/components/dashboard/ChangePasswordForm.vue'
import SecurityForm from '@/components/dashboard/SecurityForm.vue'

const session = useSessionStore()
const { loadError, retry } = usePageLoad(async () => {
  if (!session.userFetched) {
    await session.fetchUserInfo()
  }
})
</script>

<template>
  <div class="max-w-2xl space-y-6 animate-page-enter">
    <h1 class="font-display text-2xl font-bold">账户设置</h1>

    <LoadingSkeleton v-if="session.isLoading && !loadError" variant="form" />

    <div v-else-if="loadError" class="text-center py-12">
      <p class="text-base-content/60 mb-4">加载失败</p>
      <AppButton variant="outline" size="sm" @click="retry">重试</AppButton>
    </div>

    <template v-else>
      <!-- 用户信息卡（只读） -->
      <AppCard compact>
        <div class="flex items-center gap-4">
          <div
            class="w-12 h-12 rounded-full bg-primary/10 text-primary font-display text-xl font-bold flex items-center justify-center"
          >
            {{ (session.username || '?')[0] }}
          </div>
          <div>
            <div class="font-medium">{{ session.username }}</div>
            <div class="flex items-center gap-2 mt-1">
              <span class="badge badge-primary badge-sm">{{ session.tierDisplay }}</span>
              <span v-if="session.expiresAt" class="text-xs text-base-content/50">
                到期：{{ session.expiresAt.slice(0, 10) }}
              </span>
            </div>
          </div>
        </div>
      </AppCard>

      <!-- 修改密码 -->
      <ChangePasswordForm />

      <!-- 密保设置 -->
      <SecurityForm />
    </template>
  </div>
</template>
