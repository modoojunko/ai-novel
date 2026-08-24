<script setup lang="ts">
/**
 * 设计系统弹窗（原型 scrim + .modal/.mcard 的 Vue 化）：
 * 两段式 .show 进出场（200ms 退场后卸载）、Esc 关闭、Tab 焦点圈、
 * 关闭后还原焦点；挂载到 body（脱离任意 transform 祖先的 containing block）。
 */
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import Ico from './Ico.vue'
import { P } from './icons'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
}>(), {
  title: '',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const render = ref(false)
const shown = ref(false)
const rootEl = ref<HTMLElement>()
let hideTimer: ReturnType<typeof setTimeout> | null = null
let lastFocus: HTMLElement | null = null

function close() {
  emit('update:open', false)
}

function focusables(): HTMLElement[] {
  if (!rootEl.value) return []
  return [...rootEl.value.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea')]
    .filter(el => !(el as HTMLButtonElement).disabled && el.offsetParent !== null)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
    return
  }
  if (e.key !== 'Tab') return
  const list = focusables()
  if (!list.length) return
  const first = list[0]
  const last = list[list.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

watch(() => props.open, async (val) => {
  if (val) {
    lastFocus = document.activeElement as HTMLElement | null
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
    render.value = true
    window.addEventListener('keydown', onKeydown)
    await nextTick()
    requestAnimationFrame(() => {
      shown.value = true
      const first = focusables()[0]
      first?.focus()
    })
  } else {
    shown.value = false
    window.removeEventListener('keydown', onKeydown)
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      render.value = false
      lastFocus?.focus?.()
    }, 200)
  }
}, { immediate: true })

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<template>
  <Teleport to="body">
    <template v-if="render">
      <div class="scrim" :class="{ show: shown }" @click="close" />
      <div
        ref="rootEl"
        class="modal"
        :class="{ show: shown }"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.self="close"
      >
        <div class="mcard">
          <div class="mcard-head">
            <span class="mh serif">{{ title }}</span>
            <button class="icon-btn x" aria-label="关闭" @click="close">
              <Ico :d="P.close" :sw="1.8" />
            </button>
          </div>
          <div class="mcard-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="mcard-foot">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </template>
  </Teleport>
</template>
