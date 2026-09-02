import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { warmUpBackend, setApiBase } from './api/request'
import { loadSiteConfig } from './lib/site-config'
import { applyBeianOverride } from './constants/site-beian'
import './style.css'
import './design/base.css'
import './design/landing.css'
import './design/dashboard.css'

// 异步 bootstrap：挂载前应用运行时站点配置（site-config.json，生产 only，
// 失败 fail-open），保证首个 API 请求与备案条渲染都拿到最终值
async function bootstrap(): Promise<void> {
  const cfg = await loadSiteConfig()
  if (cfg.apiBase) setApiBase(cfg.apiBase)
  applyBeianOverride(cfg)

  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')

  // 预热云端后端（冷启动兜底，本地无副作用）；在配置应用后发起，天然使用最终基址
  warmUpBackend()
}

void bootstrap()
