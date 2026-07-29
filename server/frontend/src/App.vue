<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()
</script>

<template>
  <router-view />

  <!-- 全局 Toast -->
  <Teleport to="body">
    <div
      v-if="toastStore.visible"
      class="toast toast-top toast-center z-50 animate-fade-up"
      :class="{
        'alert alert-success': toastStore.type === 'success',
        'alert alert-error': toastStore.type === 'error',
        'alert alert-warning': toastStore.type === 'warning',
        'alert alert-info': toastStore.type === 'info',
      }"
    >
      <span>{{ toastStore.message }}</span>
    </div>
  </Teleport>
</template>
