<script setup lang="ts">
import { ref } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { usePageLoad } from '@/composables/usePageLoad'
import DeviceCard from '@/components/dashboard/DeviceCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppModal from '@/components/ui/AppModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton.vue'
import { P } from '@/components/ui/icons'

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
  <div class="page-col">
    <div class="page-head">
      <div>
        <h1>我的设备</h1>
        <p class="sub">在桌面端完成首次授权后，设备会自动出现在这里</p>
      </div>
    </div>

    <!-- 状态摘要条 -->
    <div class="stat-tiles two">
      <div class="stat">
        <div class="k">已激活</div>
        <div class="v num">{{ deviceStore.activatedCount }} / {{ deviceStore.activeLimit }}<small>台</small></div>
      </div>
      <div class="stat">
        <div class="k">共绑定</div>
        <div class="v num">{{ deviceStore.totalCount }}<small>台</small></div>
      </div>
    </div>

    <!-- 加载态 -->
    <LoadingSkeleton v-if="deviceStore.isLoading" variant="devices" />

    <!-- 错误态 -->
    <div v-else-if="loadError" class="err-box">
      <p>加载失败</p>
      <AppButton variant="secondary" size="sm" @click="retry">重试</AppButton>
    </div>

    <!-- 空态 -->
    <EmptyState
      v-else-if="deviceStore.devices.length === 0"
      :icon="P.monitor"
      title="暂无绑定设备"
      description="在桌面端完成首次授权后，设备会出现在这里"
    />

    <!-- 设备列表 -->
    <div v-else class="dev-list">
      <DeviceCard
        v-for="device in deviceStore.devices"
        :key="device.id"
        :device="device"
        @remove="confirmRemove"
      />
    </div>

    <!-- 移除确认模态 -->
    <AppModal v-model:open="showRemoveConfirm" title="确认移除设备">
      <p class="rm-text">
        设备：<strong>{{ removingDeviceName }}</strong><br>
        移除后该设备将无法使用全功能，确定移除？
      </p>
      <template #footer>
        <AppButton variant="ghost" size="sm" @click="showRemoveConfirm = false">取消</AppButton>
        <AppButton variant="error" size="sm" @click="doRemove">确认移除</AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.page-col { display: flex; flex-direction: column; gap: 20px; }
.stat-tiles.two { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 0; }
.dev-list { display: flex; flex-direction: column; gap: 10px; }
.err-box { text-align: center; padding: 48px 0; color: var(--muted); display: flex; flex-direction: column; align-items: center; gap: 12px; }
.rm-text { font-size: 13.5px; line-height: 1.7; margin: 0 0 8px; }
.rm-text strong { color: var(--fg); }
</style>
