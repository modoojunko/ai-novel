import { ref, onMounted } from 'vue'

/** 页面级数据加载：统一 loadError + 重试样板，挂载时自动执行一次 */
export function usePageLoad(loader: () => Promise<unknown>) {
  const loadError = ref(false)

  async function run(): Promise<void> {
    loadError.value = false
    try {
      await loader()
    } catch {
      loadError.value = true
    }
  }

  onMounted(run)

  return { loadError, retry: run }
}
