<script setup lang="ts">
import AppCard from '@/components/ui/AppCard.vue'
import {
  BookOpen, Bot, Brain, FileText, Library, LineChart, ListTodo, Lock, PenLine, Settings, Wand2, Zap,
} from 'lucide-vue-next'

// 三大痛点支柱：怕烂尾 / 不像你 / 有 AI 味（文案以用户语言呈现，不用内部术语）
const pillars = [
  {
    num: '01',
    title: '怕烂尾？',
    promise: '开写前有蓝图，过程中有人盯',
    points: [
      { title: '一步一步来，不给你跳步的机会', desc: '设定、大纲、章纲、正文、归档，每一步都有检查，缺了什么会提醒你补上' },
      { title: '卡住了？让角色先演一遍', desc: '剧情推演：把角色放进场景里走一回合，合情合理的走向自然浮现' },
      { title: '写一页是一页，随时回到之前任何一稿', desc: '自动保存每一版，写坏了也不怕，一键找回' },
    ],
  },
  {
    num: '02',
    title: '不像你？',
    promise: '越写越像你',
    points: [
      { title: '你的文风，AI 一学就会', desc: '设定一次叙事方式与描写习惯，全书 AI 都按你的风格写' },
      { title: '去 AI 味', desc: '避开一眼假的机器腔：疲劳词、固定句式、套路描写，帮你拦下来' },
      { title: '10 秒建书，旧稿也能接着写', desc: '填个书名就能开写；已有稿子导入后无缝续写' },
    ],
  },
  {
    num: '03',
    title: '有 AI 味？',
    promise: '机器腔与逻辑漏洞，定稿前拦下',
    points: [
      { title: '每段写完，自动质检', desc: '逻辑硬伤、风格跑偏、人物走形、节奏失衡，生成完当场揪出来' },
      { title: '记得前文的 AI', desc: '它清楚前情、记得角色、守你的文风，接得上你写的内容' },
      { title: '从生成到定稿，全程防 AI 味', desc: 'AI 写作时就带着你的风格，成稿前再整体查一遍' },
    ],
  },
]

// 六阶段工作流的用户语言呈现（提示词为内部环节，不向用户展示——对齐 PM 评审）
const workflowSteps = [
  { icon: BookOpen, title: '建书', desc: '填个书名，10 秒开写' },
  { icon: Settings, title: '设定', desc: '世界观与角色，可深可浅' },
  { icon: ListTodo, title: '大纲', desc: '分卷规划，剧情不跑偏' },
  { icon: FileText, title: '章纲', desc: '每章动笔前，先想好写什么' },
  { icon: PenLine, title: '写作', desc: '手写或 AI 协作，一章一章推' },
  { icon: Library, title: '归档', desc: '定稿收藏，随时回来改' },
]

const keyFeatures = [
  { icon: Zap, title: 'AI 写本章', desc: '一口气写完整章，也能续写、润色、扩写，随时喊停' },
  { icon: Brain, title: '剧情推演', desc: '卡文时让角色先演一遍，看走向合不合理' },
  { icon: Wand2, title: '去 AI 味', desc: '避开机器腔，越写越像你' },
  { icon: Bot, title: '模型随你选', desc: '接你自己的 AI 服务，DeepSeek、Kimi、通义等主流模型都支持' },
  { icon: Lock, title: '数据不出电脑', desc: '稿子存在本地，关网也能写' },
  { icon: LineChart, title: '花费心中有数', desc: 'AI 按用量计费，写之前先告诉你大概花多少' },
]
</script>

<template>
  <section id="features" class="py-16 lg:py-24">
    <h2 class="font-display text-3xl font-bold text-center">设计思路</h2>
    <p class="text-center text-base-content/60 mt-2 mb-12">三个最常见的写作困境，一次解决</p>

    <!-- 三大痛点支柱 -->
    <div class="grid md:grid-cols-3 gap-6">
      <AppCard
        v-for="(pillar, i) in pillars"
        :key="pillar.num"
        hoverable
        class="animate-fade-up"
        :style="{ animationDelay: `${i * 0.08}s` }"
      >
        <div class="font-display text-4xl font-bold text-primary/50">{{ pillar.num }}</div>
        <h3 class="font-serif text-xl font-bold mt-2">{{ pillar.title }}</h3>
        <p class="text-sm text-primary mt-1">{{ pillar.promise }}</p>
        <div class="mt-4 space-y-3">
          <div
            v-for="point in pillar.points"
            :key="point.title"
            class="rounded-lg bg-base-200/60 border border-base-300/40 p-3"
          >
            <h4 class="text-sm font-medium">{{ point.title }}</h4>
            <p class="text-xs text-base-content/50 mt-1">{{ point.desc }}</p>
          </div>
        </div>
      </AppCard>
    </div>

    <!-- 六阶段工作流：桌面端 6 列网格 -->
    <div class="mt-16 mb-4 text-center">
      <h3 class="font-display text-xl font-bold">六阶段创作流程</h3>
      <p class="text-sm text-base-content/60 mt-1">从灵感到成书，每一步都有明确的出口</p>
    </div>
    <div class="hidden lg:grid lg:grid-cols-6 gap-4">
      <AppCard
        v-for="(step, i) in workflowSteps"
        :key="step.title"
        compact
        hoverable
        class="text-center animate-fade-up"
        :style="{ animationDelay: `${i * 0.08}s` }"
      >
        <div class="mb-2 flex justify-center">
          <component :is="step.icon" class="w-6 h-6 text-primary" />
        </div>
        <div class="font-medium text-sm">{{ step.title }}</div>
        <div class="text-xs text-base-content/50 mt-1">{{ step.desc }}</div>
      </AppCard>
    </div>

    <!-- 六阶段工作流：移动端纵向 steps -->
    <ul class="steps steps-vertical lg:hidden mt-6">
      <li v-for="step in workflowSteps" :key="step.title" class="step">
        <div class="text-left">
          <div class="font-medium flex items-center gap-1.5">
            <component :is="step.icon" class="w-4 h-4 text-primary" />
            {{ step.title }}
          </div>
          <div class="text-xs text-base-content/50">{{ step.desc }}</div>
        </div>
      </li>
    </ul>

    <!-- 关键功能条 -->
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
      <div
        v-for="(feature, i) in keyFeatures"
        :key="feature.title"
        class="text-center animate-fade-up"
        :style="{ animationDelay: `${i * 0.1}s` }"
      >
        <div class="mb-2 flex justify-center">
          <component :is="feature.icon" class="w-7 h-7 text-primary" />
        </div>
        <div class="font-medium mb-1">{{ feature.title }}</div>
        <div class="text-sm text-base-content/60">{{ feature.desc }}</div>
      </div>
    </div>
  </section>
</template>
