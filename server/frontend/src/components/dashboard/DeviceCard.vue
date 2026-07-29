<script setup lang="ts">
import { computed } from 'vue'
import { Monitor, Laptop, Terminal } from 'lucide-vue-next'
import type { DeviceItem } from '@/api/web'
import AppCard from '@/components/ui/AppCard.vue'

const props = defineProps<{
  device: DeviceItem
}>()

const emit = defineEmits<{
  remove: [id: string]
}>()

const osIcon = computed(() => {
  const os = props.device.os?.toLowerCase() || ''
  if (os.includes('darwin') || os.includes('macos')) return Laptop
  if (os.includes('linux')) return Terminal
  return Monitor
})

const relativeTime = computed(() => {
  if (!props.device.last_active_at) return '未知'
  const now = new Date()
  const last = new Date(props.device.last_active_at)
  const diff = Math.floor((now.getTime() - last.getTime()) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`
  return props.device.last_active_at.slice(0, 10)
})

const statusBadge = computed(() => {
  if (props.device.activated) return { cls: 'badge-success', text: '已激活' }
  const code = props.device.reason?.code
  if (code === 'account_inactive') return { cls: 'badge-warning', text: '账号未激活' }
  if (code === 'limit_exceeded') return { cls: 'badge-ghost', text: '超出限额' }
  return { cls: 'badge-ghost', text: '未激活' }
})
</script>

<template>
  <AppCard compact>
    <div class="flex items-center gap-4">
      <!-- 设备图标 -->
      <component :is="osIcon" class="w-10 h-10 text-primary/70 shrink-0" />

      <!-- 中部信息 -->
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-medium truncate">{{ device.hostname }}</span>
          <span
            v-if="device.is_current"
            class="badge badge-primary badge-outline badge-sm"
          >
            当前设备
          </span>
        </div>
        <div class="text-xs text-base-content/50">
          {{ device.os }} · {{ device.os_arch }}
        </div>
        <div class="text-xs text-base-content/50">
          最后活跃：{{ relativeTime }}
        </div>
      </div>

      <!-- 右侧状态与操作 -->
      <div class="flex items-center gap-2 shrink-0">
        <div
          class="tooltip"
          :data-tip="device.reason?.message || statusBadge.text"
        >
          <span class="badge badge-sm" :class="statusBadge.cls">{{ statusBadge.text }}</span>
        </div>

        <button
          v-if="!device.is_current"
          class="btn btn-error btn-outline btn-sm"
          @click="$emit('remove', device.id)"
        >
          移除
        </button>
        <div v-else class="tooltip" data-tip="当前设备不可移除">
          <button class="btn btn-error btn-outline btn-sm" disabled>移除</button>
        </div>
      </div>
    </div>
  </AppCard>
</template>
