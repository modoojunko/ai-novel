<script setup lang="ts">
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'

const faqs = [
  {
    q: '我不会用电脑，能装上吗？',
    a: '能。下载 Windows 版双击即用，装好就能写；注册即送 7 天全功能试用。',
  },
  {
    q: '生成的文字有 AI 味怎么办？',
    a: '默认就帮你压住 AI 味：写作前先定风格和视角，成稿后自动检查一遍；你改过的地方它会记住，越用越像你。',
  },
  {
    q: '可以用我自己的写作风格吗？',
    a: '可以。在「写作风格」里说说你的叙事方式和描写习惯，设定一次，全书所有 AI 输出都按你的风格来。',
  },
  {
    q: '写到一半可以改设定吗？',
    a: '随时改。世界观、角色、风格都能随时调整，之后的章节会自动跟着新设定走，改错了还能找回旧稿。',
  },
]
</script>

<template>
  <section id="faq" class="mkt-section">
    <div class="mkt-in">
      <div class="mb-10 text-center">
        <span class="mkt-eyebrow">常见问题</span>
        <h2 class="mkt-h2">关于创作与 AI 的疑问</h2>
        <p class="mkt-lead max-w-lg mx-auto">这里都有答案</p>
      </div>
      <div class="max-w-2xl mx-auto flex flex-col gap-2.5">
        <details v-for="faq in faqs" :key="faq.q" class="faq-item">
          <summary>
            {{ faq.q }}
            <span class="fq-ic"><Ico :d="P.chevronDown" /></span>
          </summary>
          <div class="fq-a">{{ faq.a }}</div>
        </details>
      </div>
    </div>
  </section>
</template>
