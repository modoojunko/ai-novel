<script setup lang="ts">
</script>

<template>
  <section id="guide" class="py-16 lg:py-24">
    <h2 class="font-display text-3xl font-bold text-center">三步开始创作</h2>
    <p class="text-center text-base-content/60 mt-2 mb-12">从下载到创作，只需三步</p>

    <div class="grid md:grid-cols-3 gap-8">
      <!-- 步骤 1 -->
      <div class="flex md:flex-col items-start md:items-center gap-4 relative">
        <div class="w-10 h-10 rounded-full bg-primary text-primary-content font-display font-bold flex items-center justify-center shrink-0">
          1
        </div>
        <div class="md:text-center">
          <div class="font-medium mb-1">📥 下载安装</div>
          <p class="text-sm text-base-content/60">从 GitHub Releases 下载 Windows 客户端，双击即用</p>
        </div>
        <!-- 虚线连接（桌面端） -->
        <div class="hidden md:block absolute top-5 left-[calc(50%+2rem)] w-[calc(100%-3rem)] border-t-2 border-dashed border-base-300" />
      </div>

      <!-- 步骤 2 -->
      <div class="flex md:flex-col items-start md:items-center gap-4 relative">
        <div class="w-10 h-10 rounded-full bg-primary text-primary-content font-display font-bold flex items-center justify-center shrink-0">
          2
        </div>
        <div class="md:text-center">
          <div class="font-medium mb-1">👤 注册账号</div>
          <p class="text-sm text-base-content/60">应用内或本站注册，自动获得 7 天全功能试用</p>
        </div>
        <div class="hidden md:block absolute top-5 left-[calc(50%+2rem)] w-[calc(100%-3rem)] border-t-2 border-dashed border-base-300" />
      </div>

      <!-- 步骤 3 -->
      <div class="flex md:flex-col items-start md:items-center gap-4">
        <div class="w-10 h-10 rounded-full bg-primary text-primary-content font-display font-bold flex items-center justify-center shrink-0">
          3
        </div>
        <div class="md:text-center">
          <div class="font-medium mb-1">🔑 激活 License</div>
          <p class="text-sm text-base-content/60">淘宝购买激活码，在控制台一键激活，设备自动绑定</p>
        </div>
      </div>
    </div>

    <p class="text-center mt-8">
      <router-link to="/login" class="link link-primary text-sm">已有账号？前往控制台激活 →</router-link>
    </p>
  </section>
</template>
