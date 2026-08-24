import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { warmUpBackend } from './api/request'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

// 预热云端后端（冷启动兜底，本地无副作用）
warmUpBackend()
