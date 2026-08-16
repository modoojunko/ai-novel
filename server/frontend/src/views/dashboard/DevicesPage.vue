<script setup lang="ts">
import { ref } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { usePageLoad } from '@/composables/usePageLoad'
import DeviceCard from '@/components/dashboard/DeviceCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppModal from '@/components/ui/AppModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton.vue'

const deviceStore = useDeviceStore()

const showRemoveConfirm = ref(false)
const removingDeviceId = ref('')
const removingDeviceName = ref('')
const { loadError, retry } = usePageLoad(() => deviceStore.fetchDevices())

function confirmRemove(deviceId: string) {
  const device = deviceStore.devices.find(d => d.id === deviceId)
  removingDeviceId.value = deviceId
  removingDeviceName.value = device?.hostname || '未知设备'
  showRemoveConfirm.value = true
}

async function doRemove() {
  if (!removingDeviceId.value) return
  showRemoveConfirm.value = false
  await deviceStore.removeDevice(removingDeviceId.value)
  removingDeviceId.value = ''
}
</script>

<template>
  <div class="space-y-6 animate-page-enter">
    <h1 class="font-display text-2xl font-bold">我的设备</h1>

    <!-- 状态摘要条 -->
    <div class="stats stats-horizontal bg-base-100 border border-base-300 shadow-sm w-full">
      <div class="stat">
        <div class="stat-title">已激活</div>
        <div class="stat-value">{{ deviceStore.activatedCount }} / {{ deviceStore.activeLimit }}</div>
        <div class="stat-desc">台</div>
      </div>
      <div class="stat">
        <div class="stat-title">共绑定</div>
        <div class="stat-value text-base-content">{{ deviceStore.totalCount }}</div>
        <div class="stat-desc">台</div>
      </div>
    </div>

    <!-- 加载态 -->
    <LoadingSkeleton v-if="deviceStore.isLoading" variant="devices" />

    <!-- 错误态 -->
    <div v-else-if="loadError" class="text-center py-12">
      <p class="text-base-content/60 mb-4">加载失败</p>
      <AppButton variant="outline" size="sm" @click="retry">重试</AppButton>
    </div>

    <!-- 空态 -->
    <EmptyState
      v-else-if="deviceStore.devices.length === 0"
      icon="🖥️"
      title="暂无绑定设备"
      description="在桌面端完成首次授权后，设备会出现在这里"
    />

    <!-- 设备列表 -->
    <div v-else class="space-y-3">
      <DeviceCard
        v-for="device in deviceStore.devices"
        :key="device.id"
        :device="device"
        @remove="confirmRemove"
      />
    </div>

    <!-- 移除确认模态 -->
    <AppModal v-model:open="showRemoveConfirm" title="确认移除设备">
      <p class="text-sm text-base-content/80 mb-6">
        设备：<strong>{{ removingDeviceName }}</strong><br>
        移除后该设备将无法使用全功能，确定移除？
      </p>
      <div class="modal-action">
        <AppButton variant="ghost" size="sm" @click="showRemoveConfirm = false">取消</AppButton>
        <AppButton variant="error" size="sm" @click="doRemove">确认移除</AppButton>
      </div>
    </AppModal>
  </div>
</template>
