<script setup lang="ts">
import AppCard from '@/components/ui/AppCard.vue'
import { Brain, FileText, Link, MessagesSquare } from 'lucide-vue-next'

// PM 规划中的能力（docs/superpowers/specs/2026-08-13-paid-ai-capabilities-design.md）
const roadmap = [
  { icon: FileText, title: 'AI 写章纲', desc: '下一章写什么，AI 先给你一份草稿，你确认后再动笔' },
  { icon: Brain, title: '记性更好的 AI', desc: '写到几十万字，前情照样记得清，前后不打架' },
  { icon: Link, title: '伏笔不丢，人设不崩', desc: '每章写完自动帮你记下角色状态和埋下的坑' },
  { icon: MessagesSquare, title: '动笔前先聊聊', desc: '开写前和 AI 把设定聊透，把「想写」变成「在写」' },
]
</script>

<template>
  <section id="roadmap" class="py-16 lg:py-24 bg-base-200/30 border-y border-base-300/30">
    <div class="max-w-5xl mx-auto px-6">
      <h2 class="font-display text-3xl font-bold text-center">即将上线</h2>
      <p class="text-center text-base-content/60 mt-2 mb-12">规划中的能力，敬请期待</p>
      <div class="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <AppCard
          v-for="(item, i) in roadmap"
          :key="item.title"
          hoverable
          class="relative animate-fade-up"
          :style="{ animationDelay: `${i * 0.08}s` }"
        >
          <span class="absolute -top-3 right-5 text-xs px-3 py-0.5 rounded-full bg-base-300 text-base-content/70">
            规划中
          </span>
          <component :is="item.icon" class="w-7 h-7 text-primary mb-3" />
          <h3 class="font-serif font-bold">{{ item.title }}</h3>
          <p class="text-sm text-base-content/60 mt-1">{{ item.desc }}</p>
        </AppCard>
      </div>
    </div>
  </section>
</template>
