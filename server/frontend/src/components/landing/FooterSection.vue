<script setup lang="ts">
</script>

<template>
  <footer class="border-t border-base-300 py-10 text-sm text-base-content/60">
    <div class="flex justify-center gap-6">
      <a href="https://shop.taobao.com" target="_blank" rel="noopener" class="link link-hover">淘宝店铺</a>
      <a href="https://github.com/mooodjunko/ai-novel" target="_blank" rel="noopener" class="link link-hover">GitHub</a>
      <router-link to="/login" class="link link-hover">控制台登录</router-link>
    </div>
    <p class="font-serif text-center mt-4 text-base-content/70 max-w-lg mx-auto">
      "你的小说永远属于你 —— 所有创作内容存储在本地，我们不收集任何用户数据。"
    </p>
    <p class="text-center mt-4 text-base-content/40 text-xs">
      © 2026 爱小说 · AI Novel
    </p>
  </footer>
</template>
