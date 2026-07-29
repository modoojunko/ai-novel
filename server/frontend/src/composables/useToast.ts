import { useToastStore } from '@/stores/toast'
import type { ToastType } from '@/stores/toast'

export function useToast() {
  const store = useToastStore()

  return {
    success: (msg: string) => store.show(msg, 'success'),
    error:   (msg: string) => store.show(msg, 'error', 0),
    warning: (msg: string) => store.show(msg, 'warning', 0),
    info:    (msg: string) => store.show(msg, 'info'),
    show:    (msg: string, type: ToastType, duration?: number) => store.show(msg, type, duration),
    hide:    () => store.hide(),
  }
}
