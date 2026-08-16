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
        人铸灵魂，
        <span class="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
          AI 行笔墨
        </span>
      </h1>
      <p class="font-serif text-lg text-base-content/70 max-w-md">
        AI 是笔，你才是作家。构想由你铸就，文字交给 AI，成稿由你拍板。
      </p>
      <div class="flex flex-wrap gap-2">
        <span class="badge badge-outline">装在自己电脑上</span>
        <span class="badge badge-outline">从灵感到成书</span>
        <span class="badge badge-outline">数据只属于你</span>
      </div>

      <div class="flex flex-wrap gap-3">
        <AppButton
          v-if="session.isLoggedIn"
          to="/dashboard"
          variant="primary"
          size="lg"
        >
          进入控制台
        </AppButton>
        <AppButton
          v-else
          href="https://github.com/mooodjunko/ai-novel/releases/latest"
          variant="primary"
          size="lg"
        >
          下载 Windows 版
        </AppButton>
        <AppButton href="#pricing" variant="outline" size="lg">查看套餐</AppButton>
      </div>

      <p class="text-sm text-base-content/50">
        已有激活码？
        <router-link to="/login" class="link link-primary">去控制台激活 →</router-link>
      </p>
      <p class="text-sm text-base-content/40">
        Windows 版本 · ~120MB · 注册即送 7 天试用
      </p>
    </div>

    <!-- 右侧产品界面示意图（纯 CSS 绘制，随主题自动适配；待 C 端定稿后替换为真实截图） -->
    <div class="card bg-base-200 border border-base-300 shadow-xl rounded-box overflow-hidden">
      <!-- 窗口栏 -->
      <div class="flex items-center gap-1.5 px-4 py-2.5 border-b border-base-300/70">
        <span class="w-2.5 h-2.5 rounded-full bg-red-400/80"></span>
        <span class="w-2.5 h-2.5 rounded-full bg-yellow-400/80"></span>
        <span class="w-2.5 h-2.5 rounded-full bg-green-400/80"></span>
        <div class="mx-auto text-[10px] text-base-content/40 font-display">写作工作室</div>
      </div>
      <!-- 工作区：六阶段侧栏 + 文稿行 -->
      <div class="flex gap-3 p-4">
        <div class="w-24 shrink-0 space-y-1.5">
          <div
            v-for="step in ['建书', '设定', '大纲', '章纲', '写作', '归档']"
            :key="step"
            class="text-[10px] px-2 py-1 rounded-md bg-base-100 border border-base-300/50"
            :class="step === '写作' ? 'border-primary text-primary font-medium' : 'text-base-content/50'"
          >
            {{ step }}
          </div>
        </div>
        <div class="flex-1 space-y-2 pt-1">
          <div class="h-2.5 w-3/4 rounded-full bg-base-300/70"></div>
          <div class="h-2.5 w-2/3 rounded-full bg-base-300/50"></div>
          <div class="h-2.5 w-4/5 rounded-full bg-base-300/50"></div>
          <div class="h-2.5 w-1/2 rounded-full bg-base-300/50"></div>
        </div>
      </div>
    </div>
  </section>
</template>
