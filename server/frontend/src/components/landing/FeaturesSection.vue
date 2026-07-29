<script setup lang="ts">
const workflowSteps = [
  { icon: '📝', title: '初始化', desc: '创建项目骨架' },
  { icon: '⚙️', title: '设定', desc: '世界观与风格' },
  { icon: '📋', title: '大纲', desc: '章节规划' },
  { icon: '💡', title: '提示词', desc: 'AI 指令编排' },
  { icon: '✍️', title: '写作', desc: 'SSE 流式生成' },
  { icon: '📚', title: '归档', desc: '导出与整理' },
]

const keyFeatures = [
  { icon: '⚡', title: 'SSE 流式写作', desc: '每段独立流式生成，可暂停/停止' },
  { icon: '🤖', title: '任意 AI 模型', desc: '自带 API Key，多厂商自由切换' },
  { icon: '🧠', title: '剧情推演引擎', desc: 'AI 驱动的角色关系推演' },
  { icon: '🔒', title: '本地离线存储', desc: '数据完全由你掌控' },
]
</script>

<template>
  <section id="features" class="py-16 lg:py-24">
    <h2 class="font-display text-3xl font-bold text-center">六阶段创作工作流</h2>
    <p class="text-center text-base-content/60 mt-2 mb-12">从灵感到成书，每一步都有明确的出口</p>

    <!-- 桌面端：6 列网格 -->
    <div class="hidden lg:grid lg:grid-cols-6 gap-4">
      <div
        v-for="(step, i) in workflowSteps"
        :key="step.title"
        class="card bg-base-100 border border-base-300 p-4 text-center hover:border-primary/40 transition-colors duration-200"
        :class="`animate-fade-up`"
        :style="{ animationDelay: `${i * 0.08}s` }"
      >
        <div class="text-2xl text-primary mb-2 group-hover:scale-110 transition-transform">
          {{ step.icon }}
        </div>
        <div class="font-medium text-sm">{{ step.title }}</div>
        <div class="text-xs text-base-content/50 mt-1">{{ step.desc }}</div>
      </div>
    </div>

    <!-- 移动端：纵向 steps -->
    <ul class="steps steps-vertical lg:hidden">
      <li v-for="step in workflowSteps" :key="step.title" class="step">
        <div class="text-left">
          <div class="font-medium">{{ step.icon }} {{ step.title }}</div>
          <div class="text-xs text-base-content/50">{{ step.desc }}</div>
        </div>
      </li>
    </ul>

    <!-- 关键功能条 -->
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
      <div
        v-for="(feature, i) in keyFeatures"
        :key="feature.title"
        class="text-center animate-fade-up"
        :style="{ animationDelay: `${i * 0.1}s` }"
      >
        <div class="text-3xl mb-2">{{ feature.icon }}</div>
        <div class="font-medium mb-1">{{ feature.title }}</div>
        <div class="text-sm text-base-content/60">{{ feature.desc }}</div>
      </div>
    </div>
  </section>
</template>
