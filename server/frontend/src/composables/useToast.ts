import { useToastStore } from '@/stores/toast'
import type { ToastType } from '@/stores/toast'

export function useToast() {
  const store = useToastStore()

  return {
    success: (msg: string) => store.show(msg, 'success'),
    // error/warning 不自动消失的策略由 store 内建，无需在此传 duration
    error:   (msg: string) => store.show(msg, 'error'),
    warning: (msg: string) => store.show(msg, 'warning'),
    info:    (msg: string) => store.show(msg, 'info'),
    show:    (msg: string, type: ToastType, duration?: number) => store.show(msg, type, duration),
    hide:    () => store.hide(),
  }
}
