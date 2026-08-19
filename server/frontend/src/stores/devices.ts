import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiDeviceMy, apiDeviceRemove } from '@/api/web'
import { warmUpBackend } from '@/api/request'
import type { DeviceItem } from '@/api/web'

export const useDeviceStore = defineStore('devices', () => {
  const devices = ref<DeviceItem[]>([])
  const totalCount = ref<number>(0)
  const activatedCount = ref<number>(0)
  const activeLimit = ref<number>(3)
  const isLoading = ref<boolean>(false)

  // 与 session.fetchUserInfo 同口径：仅重试无业务 code 的网络错误（冷启动/断连）
  const FETCH_RETRY_DELAYS_MS = [20_000, 20_000]

  async function fetchDevices(retryDelays: number[] = FETCH_RETRY_DELAYS_MS): Promise<void> {
    isLoading.value = true
    // 先等预热门闩（与站点加载的 warmUpBackend 共享同一 Promise）
    await warmUpBackend()
    let retrying = false
    try {
      const res = await apiDeviceMy()
      if (res.code === 0) {
        devices.value = res.data || []
        totalCount.value = res.total_count || 0
        activatedCount.value = res.activated_count || 0
        activeLimit.value = res.active_limit || 3
      }
    } catch (e: any) {
      if (retryDelays.length > 0 && e?.code === undefined) {
        // 网络错误（无业务 code）：后端正冷启动，保持 loading 并延迟重试
        retrying = true
        const [delay, ...rest] = retryDelays
        setTimeout(() => { fetchDevices(rest) }, delay)
      }
    } finally {
      if (!retrying) isLoading.value = false
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
