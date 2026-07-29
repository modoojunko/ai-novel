<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useDeviceStore } from '@/stores/devices'
import LicenseCard from '@/components/dashboard/LicenseCard.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppModal from '@/components/ui/AppModal.vue'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton.vue'
import ActivateCodeForm from '@/components/dashboard/ActivateCodeForm.vue'

const session = useSessionStore()
const deviceStore = useDeviceStore()

const showActivateModal = ref(false)
const loadError = ref(false)

onMounted(async () => {
  loadError.value = false
  try {
    await Promise.all([
      session.fetchUserInfo(),
      deviceStore.fetchDevices(),
    ])
  } catch {
    loadError.value = true
  }
})

function retry() {
  loadError.value = false
  Promise.all([
    session.fetchUserInfo(),
    deviceStore.fetchDevices(),
  ]).catch(() => { loadError.value = true })
}
</script>

<template>
  <div class="space-y-6 animate-page-enter">
    <!-- 欢迎行 -->
    <div>
      <h1 class="font-display text-2xl font-bold">首页</h1>
      <p class="text-sm text-base-content/60">欢迎回来，{{ session.username || '用户' }}</p>
    </div>

    <!-- 加载态 -->
    <LoadingSkeleton v-if="session.isLoading && !loadError" variant="license" />

    <!-- 错误态 -->
    <div v-else-if="loadError" class="text-center py-12">
      <p class="text-base-content/60 mb-4">加载失败</p>
      <button class="btn btn-outline btn-sm" @click="retry">重试</button>
    </div>

    <!-- 内容区 -->
    <template v-else>
      <LicenseCard @activate="showActivateModal = true" />

      <!-- 快速操作区 -->
      <div class="grid md:grid-cols-2 gap-4">
        <AppCard hoverable>
          <div class="flex items-center justify-between">
            <div>
              <div class="font-display text-3xl font-bold text-primary">
                {{ deviceStore.activatedCount }} / {{ deviceStore.activeLimit }}
              </div>
              <div class="text-sm text-base-content/60 mt-1">台已激活</div>
            </div>
            <router-link to="/dashboard/devices" class="link link-primary text-sm">管理设备 →</router-link>
          </div>
        </AppCard>

        <AppCard hoverable>
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium">账户设置</div>
              <div class="text-sm text-base-content/60 mt-1">修改密码 · 设置密保</div>
            </div>
            <router-link to="/dashboard/account" class="link link-primary text-sm">前往设置 →</router-link>
          </div>
        </AppCard>
      </div>
    </template>

    <!-- 激活码模态 -->
    <AppModal v-model:open="showActivateModal" title="激活 License">
      <ActivateCodeForm />
    </AppModal>
  </div>
</template>
