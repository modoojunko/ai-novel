<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

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
</script>

<template>
  <component
    :is="tag"
    v-bind="tagAttrs"
    class="btn"
    :class="[
      variant === 'primary' && 'btn-primary',
      variant === 'secondary' && 'btn-secondary',
      variant === 'outline' && 'btn-outline btn-primary',
      variant === 'ghost' && 'btn-ghost',
      variant === 'error' && 'btn-error btn-outline',
      variant === 'link' && 'btn-link no-underline',
      size === 'lg' && 'btn-lg',
      size === 'sm' && 'btn-sm',
      size === 'xs' && 'btn-xs',
      block && 'btn-block',
      loading && 'pointer-events-none',
    ]"
  >
    <span v-if="loading" class="loading loading-spinner loading-sm"></span>
    <slot />
  </component>
</template>
