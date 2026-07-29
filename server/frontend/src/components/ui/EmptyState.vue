<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title?: string
  description?: string
}>(), {
  icon: '📭',
  title: '暂无内容',
  description: '',
})
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <div class="text-5xl mb-4 opacity-40">{{ icon }}</div>
    <h3 class="font-display text-lg font-semibold mb-2">{{ title }}</h3>
    <p v-if="description" class="text-base-content/60 text-sm mb-6 max-w-xs">{{ description }}</p>
    <slot />
  </div>
</template>
