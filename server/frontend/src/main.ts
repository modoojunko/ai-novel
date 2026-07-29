import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

// 主题初始化
const theme = localStorage.getItem('theme') || 'parchment'
document.documentElement.setAttribute('data-theme', theme)

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
