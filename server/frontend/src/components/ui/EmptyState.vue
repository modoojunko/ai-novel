<script setup lang="ts">
import Ico from './Ico.vue'

withDefaults(defineProps<{
  /** 图标路径（icons.ts 的 P.*）；缺省不渲染图标 */
  icon?: string
  title?: string
  description?: string
}>(), {
  icon: undefined,
  title: '暂无内容',
  description: '',
})
</script>

<template>
  <div class="empty">
    <Ico v-if="icon" :d="icon" :sw="1.8" />
    <h3 class="serif">{{ title }}</h3>
    <p v-if="description">{{ description }}</p>
    <slot />
  </div>
</template>
