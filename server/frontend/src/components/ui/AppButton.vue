<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import Ico from './Ico.vue'
import { P } from './icons'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'error' | 'link'
  size?: 'lg' | 'md' | 'sm' | 'xs'
  loading?: boolean
  disabled?: boolean
  block?: boolean
  /** 传入后渲染为 <router-link>（站内导航） */
  to?: string
  /** 传入后渲染为 <a>（http 外链自动补 target=_blank rel=noopener；#锚点原样跳转） */
  href?: string
}>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  block: false,
  to: undefined,
  href: undefined,
})

const VARIANT_CLS: Record<string, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  // 原型无独立 outline 档：描边按钮即 btn-secondary
  outline: 'btn-secondary',
  ghost: 'btn-ghost',
  error: 'btn-danger',
  link: 'lnk',
}

const tag = computed(() => {
  if (props.to) return RouterLink
  if (props.href) return 'a'
  return 'button'
})

const tagAttrs = computed(() => {
  if (props.to) return { to: props.to }
  if (props.href) {
    return props.href.startsWith('http')
      ? { href: props.href, target: '_blank', rel: 'noopener' }
      : { href: props.href }
  }
  return { disabled: props.disabled || props.loading }
})

const cls = computed(() => [
  VARIANT_CLS[props.variant],
  props.size === 'lg' && 'btn-lg',
  props.size === 'sm' && 'btn-sm',
  props.size === 'xs' && 'btn-xs',
  props.block && 'btn-block',
  props.loading && 'pointer-events-none',
])
</script>

<template>
  <component :is="tag" v-bind="tagAttrs" class="btn" :class="cls">
    <Ico v-if="loading" :d="P.spinner" class="spin" />
    <slot />
  </component>
</template>
