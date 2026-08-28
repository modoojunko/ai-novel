<script setup lang="ts">
import { ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import AppButton from '@/components/ui/AppButton.vue'
import AppModal from '@/components/ui/AppModal.vue'
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'
import {
  fetchLatestRelease,
  windowsInstallerUrl,
  macosInstallerUrl,
  RELEASES_PAGE_URL,
  type LatestRelease,
} from '@/constants/client-release'

const session = useSessionStore()

// mock 书架数据（纯展示，C端 v2 书架视觉）
const books = [
  { title: '山海长歌', meta: '卷二 · 第 14 章', pct: 62, on: true },
  { title: '雾都侦探', meta: '卷一 · 完结', pct: 100 },
  { title: '星轨之下', meta: '卷一 · 第 3 章', pct: 18 },
]

// 下载弹窗：打开时实时解析线上最新版本，所见版本即所下版本
const downloadOpen = ref(false)
const latest = ref<LatestRelease | null>(null)

function openDownload() {
  downloadOpen.value = true
  latest.value = null
  void fetchLatestRelease().then((r) => { latest.value = r })
}
</script>

<template>
  <section class="mkt-in grid lg:grid-cols-2 gap-12 items-center py-16 lg:py-24">
    <!-- 左侧文字 -->
    <div class="space-y-6">
      <span class="mkt-pill">
        <Ico :d="P.spark" />
        AI 辅助长篇小说写作平台
      </span>
      <h1 class="text-4xl lg:text-[44px] font-semibold serif leading-tight m-0">
        人铸灵魂，<br />
        <span class="mkt-grad-text">AI 行笔墨</span>
      </h1>
      <p class="mkt-lead max-w-md">
        AI 是笔，你才是作家。构想由你铸就，文字交给 AI，成稿由你拍板。
      </p>
      <div class="flex flex-wrap gap-2">
        <span class="chip">装在自己电脑上</span>
        <span class="chip">从灵感到成书</span>
        <span class="chip">数据只属于你</span>
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
        <AppButton v-else variant="primary" size="lg" @click="openDownload">
          <Ico :d="P.download" />
          免费下载
        </AppButton>
        <AppButton href="#pricing" variant="secondary" size="lg">查看套餐</AppButton>
      </div>

      <p class="text-sm" style="color: var(--muted)">
        已有激活码？
        <router-link to="/login" class="lnk">去控制台激活 →</router-link>
      </p>
      <p class="text-sm" style="color: color-mix(in oklch, var(--muted) 65%, transparent)">
        支持 Windows 与 macOS · 注册即送 7 天试用
      </p>
    </div>

    <!-- 右侧产品界面示意：C端 v2 书架（纯 CSS，随 token 自动适配） -->
    <div class="hero-mock">
      <div class="hm-bar">
        <span class="hm-logo">爱</span>
        <span class="hm-title">爱小说 · 书架</span>
        <span class="hm-seg"><i class="on"></i><i></i><i></i></span>
      </div>
      <div class="hm-body">
        <div v-for="b in books" :key="b.title" class="hm-book" :class="{ on: b.on }">
          <div class="t">{{ b.title }}</div>
          <div class="m num">{{ b.meta }}</div>
          <div class="bar"><i :style="{ width: b.pct + '%' }"></i></div>
        </div>
        <div class="hm-new">+ 新建书籍</div>
      </div>
    </div>
  </section>

  <!-- 下载弹窗：所见版本即所下版本（规格见 openspec change cn-download-modal） -->
  <AppModal :open="downloadOpen" title="下载爱小说" @update:open="downloadOpen = $event">
    <template v-if="!latest">
      <p class="dl-sub">正在获取最新版本…</p>
      <div class="mt-4 space-y-2.5">
        <div class="sk h-4 w-3/4"></div>
        <div class="sk h-4 w-1/2"></div>
        <div class="sk h-4 w-2/5"></div>
      </div>
    </template>
    <template v-else>
      <span class="dl-pill" :class="latest.degraded ? 'warn' : 'info'">
        {{ latest.degraded ? `未能获取最新版，当前 v${latest.version}` : `最新版 v${latest.version}` }}
      </span>
      <p class="dl-sub">选择你的系统，安装后注册即送 7 天全功能试用</p>
      <div class="mt-4 flex flex-col gap-2">
        <AppButton
          :href="windowsInstallerUrl(latest.version)"
          variant="primary"
          size="lg"
          block
        >
          <Ico :d="P.download" />
          下载 Windows 版
        </AppButton>
        <div class="dl-note"><span>Windows 安装包</span><span>.exe</span></div>
        <AppButton
          :href="macosInstallerUrl(latest.version)"
          variant="secondary"
          size="lg"
          block
        >
          <Ico :d="P.download" />
          下载 macOS 版
        </AppButton>
        <div class="dl-note"><span>macOS 磁盘镜像</span><span>.dmg</span></div>
      </div>
      <p class="dl-hint">macOS 首次打开若提示无法验证开发者：右键 App → 「打开」</p>
      <p class="dl-hint" style="text-align: center; margin-top: 12px">
        <a :href="RELEASES_PAGE_URL" target="_blank" rel="noopener" class="lnk">查看其他版本 →</a>
      </p>
    </template>
  </AppModal>
</template>

<style scoped>
.dl-sub { margin: 10px 0 0; color: var(--muted); font-size: 13px; }
.dl-pill { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 500; }
.dl-pill.info { background: var(--accent-soft); color: var(--accent); }
.dl-pill.warn { background: var(--warn-soft); color: var(--warn); }
.dl-note { display: flex; justify-content: space-between; margin-top: -4px; font-size: 12px; color: var(--muted); }
.dl-hint { margin: 14px 0 0; font-size: 12.5px; color: var(--muted); line-height: 1.6; }
</style>
