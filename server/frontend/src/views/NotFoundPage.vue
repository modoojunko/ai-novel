<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
</script>

<template>
  <div class="auth-wrap">
    <div class="nf">
      <div class="nf-code serif num" aria-hidden="true">404</div>
      <h1>页面不存在</h1>
      <p class="nf-sub">你访问的页面可能已移除或地址有误</p>
      <AppButton to="/" variant="secondary">返回首页</AppButton>
    </div>
  </div>
</template>

<style scoped>
.nf { text-align: center; }
.nf-code { font-size: 96px; font-weight: 600; line-height: 1; color: color-mix(in oklch, var(--accent) 32%, transparent); }
h1 { font-family: var(--font-display); font-size: 24px; font-weight: 600; margin: 16px 0 0; }
.nf-sub { font-size: 13.5px; color: var(--muted); margin: 8px 0 24px; }
</style>
