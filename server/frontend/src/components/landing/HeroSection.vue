<script setup lang="ts">
import { useSessionStore } from '@/stores/session'
import AppButton from '@/components/ui/AppButton.vue'

const session = useSessionStore()
</script>

<template>
  <section class="min-h-[70vh] grid lg:grid-cols-2 gap-12 items-center py-16 lg:py-24">
    <!-- 左侧文字 -->
    <div class="space-y-6">
      <h1 class="font-display text-4xl lg:text-5xl font-bold leading-tight">
        AI 辅助长篇小说创作
      </h1>
      <p class="font-serif text-lg text-base-content/70 max-w-md">
        本地运行，数据完全由你掌控。<br>
        六阶段工作流，与 AI 协作写完你的长篇。
      </p>

      <div class="flex flex-wrap gap-3">
        <template v-if="session.isLoggedIn">
          <router-link to="/dashboard">
            <AppButton variant="primary" size="lg">进入控制台</AppButton>
          </router-link>
        </template>
        <template v-else>
          <a
            href="https://github.com/mooodjunko/ai-novel/releases/latest"
            target="_blank"
            rel="noopener"
          >
            <AppButton variant="primary" size="lg">下载 Windows 版</AppButton>
          </a>
        </template>
        <a href="#pricing">
          <AppButton variant="outline" size="lg">查看套餐</AppButton>
        </a>
      </div>

      <p class="text-sm text-base-content/50">
        已有激活码？
        <router-link to="/login" class="link link-primary">去控制台激活 →</router-link>
      </p>
      <p class="text-sm text-base-content/40">
        Windows 版本 · ~120MB · 注册即送 7 天试用
      </p>
    </div>

    <!-- 右侧产品截图 -->
    <div class="card bg-base-200 border border-base-300 shadow-xl rounded-box overflow-hidden">
      <div class="aspect-video bg-base-300/50 flex items-center justify-center text-base-content/30 font-display text-lg">
        <!-- v1: 占位截图，后续替换为实际 C端 截图 -->
        <div class="text-center p-8">
          <div class="text-4xl mb-2">📖</div>
          <div>写作工作室 · 截图</div>
        </div>
      </div>
    </div>
  </section>
</template>
