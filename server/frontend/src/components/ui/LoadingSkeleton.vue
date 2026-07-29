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
      <div class="skeleton h-6 w-1/3"></div>
      <div class="skeleton h-32 w-full rounded-box"></div>
      <div class="grid grid-cols-2 gap-4">
        <div class="skeleton h-24 rounded-box"></div>
        <div class="skeleton h-24 rounded-box"></div>
      </div>
    </template>

    <!-- Devices 骨架：状态条 + 3 个等高管线 -->
    <template v-else-if="variant === 'devices'">
      <div class="skeleton h-8 w-24 rounded-box"></div>
      <div class="skeleton h-24 w-full rounded-box"></div>
      <div class="skeleton h-24 w-full rounded-box"></div>
      <div class="skeleton h-24 w-full rounded-box"></div>
    </template>

    <!-- Form 骨架：信息卡 + 两个表单 -->
    <template v-else>
      <div class="skeleton h-6 w-1/4"></div>
      <div class="skeleton h-20 w-full rounded-box"></div>
      <div class="skeleton h-40 w-full rounded-box"></div>
      <div class="skeleton h-40 w-full rounded-box"></div>
    </template>
  </div>
</template>
