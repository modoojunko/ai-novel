<script setup lang="ts">
import AppContainer from '@/components/ui/AppContainer.vue'
</script>

<template>
  <!-- 概念条：全页核心叙事「小说创作 = 人的构想 + AI 的笔力」 -->
  <section class="py-14 lg:py-16 bg-base-200/30 border-y border-base-300/30">
    <AppContainer class="text-center space-y-5">
      <p class="font-display text-2xl lg:text-3xl font-bold">
        小说创作 = <span class="text-primary">人的构想</span> + <span class="text-primary">AI 的笔力</span>
      </p>
      <p class="font-serif text-sm lg:text-base text-base-content/60 max-w-2xl mx-auto">
        构想归你：世界观、角色、大纲。笔力归 AI：行文、节奏、去 AI 味。成稿由你拍板。
      </p>
      <div class="flex justify-center items-center gap-2 lg:gap-3 flex-wrap">
        <span class="badge badge-lg badge-outline badge-primary">构想由你铸就</span>
        <span class="text-base-content/30 font-display">→</span>
        <span class="badge badge-lg badge-outline badge-primary">文字交给 AI</span>
        <span class="text-base-content/30 font-display">→</span>
        <span class="badge badge-lg badge-outline badge-primary">成稿由你拍板</span>
      </div>
    </AppContainer>
  </section>
</template>
