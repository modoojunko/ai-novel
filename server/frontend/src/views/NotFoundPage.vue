<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6">
    <div class="text-center">
      <div class="font-display text-8xl font-bold text-primary/30" aria-hidden="true">404</div>
      <h1 class="font-display text-2xl font-bold mt-4">页面不存在</h1>
      <p class="text-sm text-base-content/60 mt-2">你访问的页面可能已移除或地址有误</p>
      <router-link to="/" class="btn btn-outline mt-6">返回首页</router-link>
    </div>
  </div>
</template>
