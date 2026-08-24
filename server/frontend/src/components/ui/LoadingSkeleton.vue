<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'license' | 'devices' | 'form'
}>(), {
  variant: 'form',
})
</script>

<template>
  <div class="flex flex-col gap-4 animate-pulse">
    <!-- License 骨架：标题 + 大卡片 + 两个小卡片 -->
    <template v-if="variant === 'license'">
      <div class="sk h-6 w-1/3"></div>
      <div class="sk h-32 w-full" style="border-radius: var(--radius-lg)"></div>
      <div class="grid grid-cols-2 gap-4">
        <div class="sk h-24" style="border-radius: var(--radius-lg)"></div>
        <div class="sk h-24" style="border-radius: var(--radius-lg)"></div>
      </div>
    </template>

    <!-- Devices 骨架：状态条 + 3 个等高管线 -->
    <template v-else-if="variant === 'devices'">
      <div class="sk h-8 w-24"></div>
      <div class="sk h-24 w-full" style="border-radius: var(--radius-lg)"></div>
      <div class="sk h-24 w-full" style="border-radius: var(--radius-lg)"></div>
      <div class="sk h-24 w-full" style="border-radius: var(--radius-lg)"></div>
    </template>

    <!-- Form 骨架：信息卡 + 两个表单 -->
    <template v-else>
      <div class="sk h-6 w-1/4"></div>
      <div class="sk h-20 w-full" style="border-radius: var(--radius-lg)"></div>
      <div class="sk h-40 w-full" style="border-radius: var(--radius-lg)"></div>
      <div class="sk h-40 w-full" style="border-radius: var(--radius-lg)"></div>
    </template>
  </div>
</template>
