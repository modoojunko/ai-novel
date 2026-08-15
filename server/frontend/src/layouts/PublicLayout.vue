<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import AppButton from '@/components/ui/AppButton.vue'
import { Moon, Sun } from 'lucide-vue-next'

const router = useRouter()
const session = useSessionStore()

const theme = ref(localStorage.getItem('theme') || 'parchment')

function toggleTheme() {
  theme.value = theme.value === 'parchment' ? 'novelforge' : 'parchment'
  document.documentElement.setAttribute('data-theme', theme.value)
  localStorage.setItem('theme', theme.value)
}

onMounted(() => {
  // 从 sessionStore 预取用户信息（如果有 token 的话）
  if (session.isLoggedIn && !session.userFetched) {
    session.fetchUserInfo()
  }
})
</script>

<template>
  <div class="navbar bg-base-100/80 backdrop-blur border-b border-base-300 sticky top-0 z-40 px-4 lg:px-8">
    <div class="navbar-start">
      <router-link to="/" class="flex items-center gap-2 font-display text-lg font-bold text-base-content no-underline">
        <span class="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-brand to-amber-deep flex items-center justify-center text-white text-sm">
          ✎
        </span>
        爱小说
      </router-link>
    </div>
    <div class="navbar-center hidden lg:flex">
      <ul class="menu menu-horizontal gap-1">
        <li><a href="#features" class="btn btn-ghost btn-sm">功能</a></li>
        <li><a href="#roadmap" class="btn btn-ghost btn-sm">路线图</a></li>
        <li><a href="#pricing" class="btn btn-ghost btn-sm">套餐</a></li>
        <li><a href="#guide" class="btn btn-ghost btn-sm">激活指南</a></li>
      </ul>
    </div>
    <div class="navbar-end gap-2">
      <AppButton
        variant="ghost"
        size="sm"
        @click="toggleTheme"
        :aria-label="theme === 'parchment' ? '切换到深色主题' : '切换到浅色主题'"
      >
        <Sun v-if="theme === 'novelforge'" class="w-4 h-4" />
        <Moon v-else class="w-4 h-4" />
      </AppButton>

      <template v-if="session.isLoggedIn">
        <AppButton to="/dashboard" size="sm">我的账号</AppButton>
      </template>
      <template v-else>
        <AppButton to="/login" variant="ghost" size="sm">登录</AppButton>
        <AppButton to="/register" size="sm">注册</AppButton>
      </template>
    </div>
  </div>

  <main>
    <router-view />
  </main>
</template>
