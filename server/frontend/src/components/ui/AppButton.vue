<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'error' | 'link'
  size?: 'lg' | 'md' | 'sm' | 'xs'
  loading?: boolean
  disabled?: boolean
  block?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  block: false,
})
</script>

<template>
  <button
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
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="loading loading-spinner loading-sm"></span>
    <slot />
  </button>
</template>
