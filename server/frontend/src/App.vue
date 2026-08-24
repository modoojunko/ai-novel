<script setup lang="ts">
import { computed } from 'vue'
import { useToastStore } from '@/stores/toast'
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'

const toastStore = useToastStore()

const toastIcon = computed(() => {
  if (toastStore.type === 'success') return P.check
  if (toastStore.type === 'error' || toastStore.type === 'warning') return P.alert
  return P.info
})
</script>

<template>
  <router-view />

  <!-- 全局 Toast（深色药丸，原型 .toast 形态） -->
  <Teleport to="body">
    <div v-if="toastStore.visible" class="toast-wrap">
      <div
        class="toast"
        :class="{
          err: toastStore.type === 'error',
          warn: toastStore.type === 'warning',
        }"
        role="status"
      >
        <Ico :d="toastIcon" />
        <span>{{ toastStore.message }}</span>
      </div>
    </div>
  </Teleport>
</template>
