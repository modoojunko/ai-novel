<script setup lang="ts">
// PM 规划中的能力（docs/superpowers/specs/2026-08-13-paid-ai-capabilities-design.md）
const roadmap = [
  { icon: '📝', title: 'AI 写章纲', desc: '下一章写什么，AI 先给你一份草稿，你确认后再动笔' },
  { icon: '🧠', title: '记性更好的 AI', desc: '写到几十万字，前情照样记得清，前后不打架' },
  { icon: '🔗', title: '伏笔不丢，人设不崩', desc: '每章写完自动帮你记下角色状态和埋下的坑' },
  { icon: '💬', title: '动笔前先聊聊', desc: '开写前和 AI 把设定聊透，把「想写」变成「在写」' },
]
</script>

<template>
  <section id="roadmap" class="py-16 lg:py-24 bg-base-200/30 border-y border-base-300/30">
    <div class="max-w-5xl mx-auto px-6">
      <h2 class="font-display text-3xl font-bold text-center">即将上线</h2>
      <p class="text-center text-base-content/60 mt-2 mb-12">规划中的能力，敬请期待</p>
      <div class="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <div
          v-for="(item, i) in roadmap"
          :key="item.title"
          class="card bg-base-100 border border-base-300 p-6 relative hover:border-primary/40 transition-colors duration-200"
          :class="`animate-fade-up`"
          :style="{ animationDelay: `${i * 0.08}s` }"
        >
          <span class="absolute -top-3 right-5 text-xs px-3 py-0.5 rounded-full bg-base-300 text-base-content/70">
            规划中
          </span>
          <div class="text-3xl mb-3">{{ item.icon }}</div>
          <h3 class="font-serif font-bold">{{ item.title }}</h3>
          <p class="text-sm text-base-content/60 mt-1">{{ item.desc }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
