<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { usePageLoad } from '@/composables/usePageLoad'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton.vue'
import ChangePasswordForm from '@/components/dashboard/ChangePasswordForm.vue'
import SecurityForm from '@/components/dashboard/SecurityForm.vue'

const session = useSessionStore()
// none→中性、trial→warn、付费→ok（与 appbar 徽标同口径）
const tierCls = computed(() => {
  if (session.tier === 'none') return ''
  if (session.tier === 'trial') return 'pill-warn'
  return 'pill-ok'
})
const { loadError, retry } = usePageLoad(async () => {
  if (!session.userFetched) {
    await session.fetchUserInfo()
  }
})
</script>

<template>
  <div class="page-col narrow">
    <div class="page-head">
      <div>
        <h1>账户设置</h1>
        <p class="sub">管理登录凭据与密保</p>
      </div>
    </div>

    <LoadingSkeleton v-if="session.isLoading && !loadError" variant="form" />

    <div v-else-if="loadError" class="err-box">
      <p>加载失败</p>
      <AppButton variant="secondary" size="sm" @click="retry">重试</AppButton>
    </div>

    <template v-else>
      <!-- 用户信息卡（只读） -->
      <AppCard compact>
        <div class="who-row">
          <div class="avatar serif">{{ (session.username || '?')[0] }}</div>
          <div>
            <div class="who-name">{{ session.username }}</div>
            <div class="who-meta">
              <span class="pill pill-status" :class="tierCls">{{ session.tierDisplay }}</span>
              <span v-if="session.expiresAt" class="exp num">
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

<style scoped>
.page-col { display: flex; flex-direction: column; gap: 20px; }
.narrow { max-width: 640px; }
.err-box { text-align: center; padding: 48px 0; color: var(--muted); display: flex; flex-direction: column; align-items: center; gap: 12px; }
.who-row { display: flex; align-items: center; gap: 14px; }
.avatar { width: 44px; height: 44px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-strong); font-size: 19px; font-weight: 600; display: grid; place-items: center; }
.who-name { font-weight: 500; }
.who-meta { display: flex; align-items: center; gap: 10px; margin-top: 5px; }
.exp { font-size: 12px; color: var(--muted); }
</style>
