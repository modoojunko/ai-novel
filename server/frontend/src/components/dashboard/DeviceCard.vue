<script setup lang="ts">
import { computed } from 'vue'
import type { DeviceItem } from '@/api/web'
import AppCard from '@/components/ui/AppCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'

const props = defineProps<{
  device: DeviceItem
}>()

const emit = defineEmits<{
  remove: [id: string]
}>()

const osIcon = computed(() => {
  const os = props.device.os?.toLowerCase() || ''
  if (os.includes('darwin') || os.includes('macos')) return P.laptop
  if (os.includes('linux')) return P.terminal
  return P.monitor
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
  if (props.device.activated) return { cls: 'ok', text: '已激活' }
  const code = props.device.reason?.code
  if (code === 'account_inactive') return { cls: 'warn', text: '账号未激活' }
  if (code === 'limit_exceeded') return { cls: 'muted', text: '超出限额' }
  return { cls: 'muted', text: '未激活' }
})
</script>

<template>
  <AppCard compact>
    <div class="row">
      <!-- 设备图标 -->
      <span class="os-ic"><Ico :d="osIcon" :sw="1.6" /></span>

      <!-- 中部信息 -->
      <div class="mid">
        <div class="name-row">
          <span class="name">{{ device.hostname }}</span>
          <span v-if="device.is_current" class="b muted">当前设备</span>
        </div>
        <div class="meta">
          {{ device.os }} · {{ device.os_arch }}
        </div>
        <div class="meta">
          最后活跃：{{ relativeTime }}
        </div>
      </div>

      <!-- 右侧状态与操作 -->
      <div class="ops">
        <span class="b" :class="statusBadge.cls" :title="device.reason?.message || statusBadge.text">
          {{ statusBadge.text }}
        </span>

        <AppButton
          v-if="!device.is_current"
          variant="error"
          size="sm"
          @click="$emit('remove', device.id)"
        >
          移除
        </AppButton>
        <AppButton v-else variant="error" size="sm" disabled title="当前设备不可移除">
          移除
        </AppButton>
      </div>
    </div>
  </AppCard>
</template>

<style scoped>
.row { display: flex; align-items: center; gap: 16px; }
.os-ic { width: 42px; height: 42px; border-radius: 10px; background: var(--accent-soft); color: var(--accent-strong); display: grid; place-items: center; flex: none; }
.os-ic svg { width: 20px; height: 20px; }
.mid { min-width: 0; flex: 1; }
.name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
.ops { display: flex; align-items: center; gap: 10px; flex: none; }
</style>
