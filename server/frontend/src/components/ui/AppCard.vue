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
    class="card bg-base-100 border border-base-300 shadow-sm transition-shadow duration-200"
    :class="[
      hoverable && 'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200',
      highlighted && 'ring-2 ring-primary shadow-lg',
    ]"
  >
    <div :class="compact ? 'card-body p-4' : 'card-body p-6'">
      <slot />
    </div>
  </div>
</template>
