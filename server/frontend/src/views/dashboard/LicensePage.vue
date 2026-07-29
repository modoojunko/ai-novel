<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSessionStore } from '@/stores/session'
import LicenseCard from '@/components/dashboard/LicenseCard.vue'
import AppModal from '@/components/ui/AppModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton.vue'
import ActivateCodeForm from '@/components/dashboard/ActivateCodeForm.vue'

const session = useSessionStore()
const showActivateModal = ref(false)
const loadError = ref(false)

onMounted(async () => {
  loadError.value = false
  try {
    await session.fetchUserInfo()
  } catch {
    loadError.value = true
  }
})

function retry() {
  loadError.value = false
  session.fetchUserInfo()
}
</script>

<template>
  <div class="space-y-6 animate-page-enter">
    <div>
      <h1 class="font-display text-2xl font-bold">我的 License</h1>
      <p class="text-sm text-base-content/60">激活码用于开通或延长套餐，同一账号可叠加多张</p>
    </div>

    <LoadingSkeleton v-if="session.isLoading && !loadError" variant="license" />

    <div v-else-if="loadError" class="text-center py-12">
      <p class="text-base-content/60 mb-4">加载失败</p>
      <button class="btn btn-outline btn-sm" @click="retry">重试</button>
    </div>

    <template v-else>
      <LicenseCard @activate="showActivateModal = true" />

      <!-- 激活码列表：预留卡片布局 -->
      <div>
        <h2 class="font-display text-lg font-semibold mb-4">已绑定的激活码</h2>
        <EmptyState
          icon="🔑"
          title="激活码明细即将上线"
          description="当前暂不支持查看已绑定的激活码列表"
        />
        <!-- 预留：卡片列表 v-for 渲染
        <div v-for="code in codes" :key="code.code_id" class="app-card compact flex flex-wrap gap-2 items-center">
          <span class="font-mono text-xs">AC-ABCD-EFGH-…</span>
          <span class="badge badge-sm">套餐</span>
          <span class="text-xs">到期日</span>
          <span class="badge badge-sm badge-success">已激活</span>
          <span class="text-xs text-base-content/50">激活时间</span>
        </div>
        -->
      </div>
    </template>

    <AppModal v-model:open="showActivateModal" title="激活 License">
      <ActivateCodeForm />
    </AppModal>
  </div>
</template>
