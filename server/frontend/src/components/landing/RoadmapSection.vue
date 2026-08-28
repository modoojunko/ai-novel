<script setup lang="ts">
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'

// PM 规划中的能力（docs/superpowers/specs/2026-08-13-paid-ai-capabilities-design.md）
const roadmap = [
  { icon: P.doc, title: 'AI 写章纲', desc: '下一章写什么，AI 先给你一份草稿，你确认后再动笔' },
  { icon: P.brain, title: '记性更好的 AI', desc: '写到几十万字，前情照样记得清，前后不打架' },
  { icon: P.link, title: '伏笔不丢，人设不崩', desc: '每章写完自动帮你记下角色状态和埋下的坑' },
  { icon: P.messages, title: '动笔前先聊聊', desc: '开写前和 AI 把设定聊透，把「想写」变成「在写」' },
]
</script>

<template>
  <section id="roadmap" class="mkt-section alt">
    <div class="mkt-in">
      <div class="mb-12 text-center">
        <span class="mkt-eyebrow">路线图</span>
        <h2 class="mkt-h2">即将上线</h2>
        <p class="mkt-lead max-w-lg mx-auto">规划中的能力，敬请期待</p>
      </div>
      <div class="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
        <div
          v-for="(item, i) in roadmap"
          :key="item.title"
          class="mkt-card rd animate-fade-up"
          :style="{ animationDelay: `${0.1 + i * 0.05}s` }"
        >
          <span class="pill pill-tag plan-tag">规划中</span>
          <div class="ico"><Ico :d="item.icon" /></div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.desc }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rd { position: relative; }
.plan-tag { position: absolute; top: 16px; right: 16px; }
</style>
