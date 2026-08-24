<script setup lang="ts">
import { ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { usePageLoad } from '@/composables/usePageLoad'
import LicenseCard from '@/components/dashboard/LicenseCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppModal from '@/components/ui/AppModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton.vue'
import ActivateCodeForm from '@/components/dashboard/ActivateCodeForm.vue'
import { P } from '@/components/ui/icons'

const session = useSessionStore()
const showActivateModal = ref(false)
const { loadError, retry } = usePageLoad(() => session.fetchUserInfo())
</script>

<template>
  <div class="page-col">
    <div class="page-head">
      <div>
        <h1>我的 License</h1>
        <p class="sub">激活码用于开通或延长套餐，同一账号可叠加多张</p>
      </div>
    </div>

    <LoadingSkeleton v-if="session.isLoading && !loadError" variant="license" />

    <div v-else-if="loadError" class="err-box">
      <p>加载失败</p>
      <AppButton variant="secondary" size="sm" @click="retry">重试</AppButton>
    </div>

    <template v-else>
      <LicenseCard @activate="showActivateModal = true" />

      <!-- 激活码列表：预留卡片布局 -->
      <div>
        <h2 class="sec-h serif">已绑定的激活码</h2>
        <EmptyState
          :icon="P.key"
          title="激活码明细即将上线"
          description="当前暂不支持查看已绑定的激活码列表"
        />
        <!-- 预留：卡片列表 v-for 渲染
        <div v-for="code in codes" :key="code.code_id" class="panel compact flex flex-wrap gap-2 items-center">
          <span class="keyline">AC-ABCD-EFGH-…</span>
          <span class="b muted">套餐</span>
          <span class="text-xs">到期日</span>
          <span class="b ok">已激活</span>
          <span class="text-xs" style="color: var(--muted)">激活时间</span>
        </div>
        -->
      </div>
    </template>

    <AppModal v-model:open="showActivateModal" title="激活 License">
      <ActivateCodeForm />
    </AppModal>
  </div>
</template>

<style scoped>
.page-col { display: flex; flex-direction: column; gap: 20px; }
.err-box { text-align: center; padding: 48px 0; color: var(--muted); display: flex; flex-direction: column; align-items: center; gap: 12px; }
</style>
