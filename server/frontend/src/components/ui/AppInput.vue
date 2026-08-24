<script setup lang="ts">
import { ref, computed } from 'vue'
import Ico from './Ico.vue'
import { P } from './icons'

const props = withDefaults(defineProps<{
  modelValue: string
  label?: string
  placeholder?: string
  type?: 'text' | 'password' | 'email'
  error?: string
  hint?: string
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
  <div class="field" :class="{ 'is-disabled': disabled }">
    <label v-if="label" :for="inputId">{{ label }}</label>
    <div class="input-wrap" :class="{ 'has-err': error }">
      <input
        class="input"
        :class="{ 'pr-10': type === 'password' }"
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
        class="pw-eye"
        tabindex="-1"
        :aria-label="showPassword ? '隐藏密码' : '显示密码'"
        @click="showPassword = !showPassword"
      >
        <Ico :d="showPassword ? P.eyeOff : P.eye" />
      </button>
    </div>
    <p v-if="error" class="f-err">{{ error }}</p>
    <p v-else-if="hint" class="f-hint">{{ hint }}</p>
  </div>
</template>
