import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiDeviceMy, apiDeviceRemove } from '@/api/web'
import type { DeviceItem } from '@/api/web'

export const useDeviceStore = defineStore('devices', () => {
  const devices = ref<DeviceItem[]>([])
  const totalCount = ref<number>(0)
  const activatedCount = ref<number>(0)
  const activeLimit = ref<number>(3)
  const isLoading = ref<boolean>(false)

  async function fetchDevices(): Promise<void> {
    isLoading.value = true
    try {
      const res = await apiDeviceMy()
      if (res.code === 0) {
        devices.value = res.data || []
        totalCount.value = res.total_count || 0
        activatedCount.value = res.activated_count || 0
        activeLimit.value = res.active_limit || 3
      }
    } catch {
      // silent
    } finally {
      isLoading.value = false
    }
  }

  async function removeDevice(deviceId: string): Promise<{ ok: boolean; msg?: string }> {
    try {
      await apiDeviceRemove(deviceId)
      await fetchDevices()
      return { ok: true }
    } catch (e: any) {
      return { ok: false, msg: e.message || '移除失败' }
    }
  }

  return {
    devices, totalCount, activatedCount, activeLimit, isLoading,
    fetchDevices, removeDevice,
  }
})
