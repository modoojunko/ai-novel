<script setup lang="ts">
import { ref, computed } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: string
  label?: string
  placeholder?: string
  type?: 'text' | 'password' | 'email'
  error?: string
  hint?: string
  icon?: string
  disabled?: boolean
  name?: string
  autocomplete?: string
}>(), {
  type: 'text',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showPassword = ref(false)
const inputId = computed(() => props.name || props.label?.replace(/\s+/g, '-').toLowerCase() || '')
const inputType = computed(() => {
  if (props.type !== 'password') return props.type
  return showPassword.value ? 'text' : 'password'
})

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <fieldset class="fieldset" :class="{ 'opacity-50': disabled }">
    <legend v-if="label" class="fieldset-legend">{{ label }}</legend>
    <label
      class="input input-bordered flex items-center gap-2 focus-within:border-primary focus-within:outline-none w-full"
      :class="{ 'input-error': error }"
    >
      <span v-if="icon" class="text-base-content/50 text-sm">{{ icon }}</span>
      <input
        class="grow"
        :id="inputId"
        :aria-label="label"
        :type="inputType"
        :placeholder
        :autocomplete
        :value="modelValue"
        :disabled
        @input="onInput"
      />
      <button
        v-if="type === 'password' && modelValue"
        type="button"
        class="btn btn-ghost btn-xs"
        tabindex="-1"
        @click="showPassword = !showPassword"
      >
        <Eye v-if="!showPassword" class="w-4 h-4 text-base-content/50" />
        <EyeOff v-else class="w-4 h-4 text-base-content/50" />
      </button>
    </label>
    <p v-if="error" class="text-error text-sm mt-1 transition-all">{{ error }}</p>
    <p v-else-if="hint" class="label-text text-xs text-base-content/60 mt-1">{{ hint }}</p>
  </fieldset>
</template>
