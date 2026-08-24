<script setup lang="ts">
/**
 * 原型内联 SVG 的 Vue 等价物：viewBox 24、stroke currentColor、fill none。
 * 线宽：原型惯例 2（通用）/ 2.2-2.4（强调）；默认 2。
 */
withDefaults(defineProps<{
  d: string
  sw?: number
  /** 圆头线帽 */
  round?: boolean
  /** 填充图标 */
  fill?: boolean
  size?: number
}>(), {
  sw: 2,
})
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    :fill="fill ? 'currentColor' : 'none'"
    :stroke="fill ? undefined : 'currentColor'"
    :stroke-width="fill ? undefined : sw"
    :stroke-linecap="round ? 'round' : undefined"
    :stroke-linejoin="round ? 'round' : undefined"
    :width="size"
    :height="size"
    aria-hidden="true"
    v-html="d"
  />
</template>
