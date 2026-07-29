import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export const useToastStore = defineStore('toast', () => {
  const message = ref('')
  const type = ref<ToastType>('info')
  const visible = ref(false)
  let timerId: ReturnType<typeof setTimeout> | null = null

  function show(msg: string, t: ToastType = 'info', duration = 3000): void {
    if (timerId) clearTimeout(timerId)
    message.value = msg
    type.value = t
    visible.value = true
    if (t !== 'error' && t !== 'warning') {
      timerId = setTimeout(() => { visible.value = false }, duration)
    }
  }

  function hide(): void {
    visible.value = false
    if (timerId) {
      clearTimeout(timerId)
      timerId = null
    }
  }

  return { message, type, visible, show, hide }
})
