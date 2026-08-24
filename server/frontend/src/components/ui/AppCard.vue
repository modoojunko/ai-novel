<script setup lang="ts">
withDefaults(defineProps<{
  hoverable?: boolean
  compact?: boolean
  highlighted?: boolean
}>(), {
  hoverable: false,
  compact: false,
  highlighted: false,
})
</script>

<template>
  <div
    class="panel"
    :class="[
      hoverable && 'hoverable',
      highlighted && 'hl',
      compact && 'compact',
    ]"
  >
    <slot />
  </div>
</template>
