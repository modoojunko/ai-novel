<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import AppCard from '@/components/ui/AppCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'
import { THEME_OPTIONS } from '@/constants/themes'

const session = useSessionStore()

const saveError = ref('')
const isSaving = ref(false)

// 失败时的重试目标：当前视觉态（已 applyTheme，未落库）
const pendingKey = ref('')

async function pick(key: string) {
  if (key === session.theme || isSaving.value) return
  saveError.value = ''
  isSaving.value = true
  pendingKey.value = key
  const res = await session.saveTheme(key)
  isSaving.value = false
  if (!res.ok) saveError.value = res.msg || '保存失败'
  else pendingKey.value = ''
}

/** 重试不能走 pick：失败时 saveTheme 已把视觉态（session.theme）切到目标，
 *  pick 的相等短路会让重试空转。直接重发 PUT，视觉态本就是它。 */
async function retry() {
  if (!pendingKey.value || isSaving.value) return
  saveError.value = ''
  isSaving.value = true
  const res = await session.saveTheme(pendingKey.value)
  isSaving.value = false
  if (!res.ok) saveError.value = res.msg || '保存失败'
  else pendingKey.value = ''
}

const savingLabel = computed(() => isSaving.value ? '保存中…' : '')
</script>

<template>
  <AppCard>
    <div class="panel-h"><h2>界面主题</h2></div>
    <p class="fm-sub">
      选择控制台的强调色，立即生效并同步到你的账号{{ savingLabel }}
    </p>

    <p v-if="saveError" class="notice err">
      <Ico :d="P.alert" />{{ saveError }}，未保存到账号
      <a class="lnk" @click.prevent="retry">重试</a>
    </p>

    <div class="swatches">
      <button
        v-for="t in THEME_OPTIONS"
        :key="t.key"
        type="button"
        class="sw"
        :class="{ on: session.theme === t.key }"
        :aria-pressed="session.theme === t.key"
        :title="t.label"
        @click="pick(t.key)"
      >
        <span class="dot" :style="{ background: t.color }">
          <Ico v-if="session.theme === t.key" class="ck" :d="P.check" />
        </span>
        <span class="lb">{{ t.label }}</span>
      </button>
    </div>
  </AppCard>
</template>

<style scoped>
.fm-sub { font-size: 13px; color: var(--muted); margin: -4px 0 14px; line-height: 1.7; }
.swatches { display: flex; flex-wrap: wrap; gap: 12px; }
.sw { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 6px 8px; border-radius: 10px; border: 1px solid transparent; background: none; cursor: pointer; }
.sw:hover { border-color: var(--border); }
.sw.on { border-color: var(--accent); background: var(--accent-soft); }
.dot { width: 34px; height: 34px; border-radius: 999px; display: grid; place-items: center; box-shadow: inset 0 0 0 2px color-mix(in oklch, white 18%, transparent); }
.ck { color: var(--on-accent); }
.lb { font-size: 12px; color: var(--muted); }
.sw.on .lb { color: var(--accent-strong); font-weight: 500; }
.lnk { color: var(--accent-strong); cursor: pointer; text-decoration: underline; margin-left: 4px; }
</style>
