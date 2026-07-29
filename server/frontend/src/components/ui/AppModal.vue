<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
}>(), {
  title: '',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const dialogEl = ref<HTMLDialogElement>()

watch(() => props.open, (val) => {
  if (val) {
    dialogEl.value?.showModal()
  } else {
    dialogEl.value?.close()
  }
})

function onClose() {
  emit('update:open', false)
}
</script>

<template>
  <dialog ref="dialogEl" class="modal" @close="onClose">
    <div class="modal-box bg-base-100">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-3 top-3">✕</button>
      </form>
      <h3 v-if="title" class="font-display text-lg font-bold mb-4">{{ title }}</h3>
      <slot />
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>
