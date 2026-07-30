<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { Moon, Sun, Home, KeyRound, Monitor, Settings, LogOut, Menu } from 'lucide-vue-next'

const router = useRouter()
const session = useSessionStore()
const drawerOpen = ref(false)

const theme = ref(localStorage.getItem('theme') || 'parchment')

function toggleTheme() {
  theme.value = theme.value === 'parchment' ? 'novelforge' : 'parchment'
  document.documentElement.setAttribute('data-theme', theme.value)
  localStorage.setItem('theme', theme.value)
}

function handleLogout() {
  session.logout()
  router.push('/')
}

onMounted(() => {
  if (session.isLoggedIn && !session.userFetched) {
    session.fetchUserInfo()
  }
})
</script>

<template>
  <div class="drawer lg:drawer-open">
    <input
      id="dash-drawer"
      type="checkbox"
      class="drawer-toggle"
      :checked="drawerOpen"
      @change="drawerOpen = !drawerOpen"
    />

    <div class="drawer-content flex flex-col">
      <!-- 移动端顶栏 -->
      <div class="navbar bg-base-100/80 backdrop-blur border-b border-base-300 sticky top-0 z-30 lg:hidden px-4">
        <div class="navbar-start">
          <label for="dash-drawer" class="btn btn-ghost btn-sm drawer-button lg:hidden">
            <Menu class="w-5 h-5" />
          </label>
        </div>
        <div class="navbar-center">
          <span class="font-display font-bold">爱小说</span>
        </div>
        <div class="navbar-end">
          <button class="btn btn-ghost btn-sm" @click="toggleTheme">
            <Sun v-if="theme === 'novelforge'" class="w-4 h-4" />
            <Moon v-else class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- 主内容区 -->
      <div class="p-6 lg:p-8 max-w-5xl w-full mx-auto">
        <router-view />
      </div>
    </div>

    <!-- 侧边栏 -->
    <div class="drawer-side">
      <label for="dash-drawer" class="drawer-overlay"></label>
      <aside class="bg-base-200 w-60 min-h-full p-4 flex flex-col border-r border-base-300">
        <!-- Logo -->
        <router-link to="/dashboard" class="flex items-center gap-2 font-display text-lg font-bold text-base-content no-underline mb-2 px-2">
          <span class="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-brand to-amber-deep flex items-center justify-center text-white text-sm">
            ✎
          </span>
          爱小说
        </router-link>

        <!-- 导航菜单 -->
        <ul class="menu grow gap-1 mt-4">
          <li>
            <router-link to="/dashboard" exact-active-class="menu-active">
              <Home class="w-4 h-4" />
              首页
            </router-link>
          </li>
          <li>
            <router-link to="/dashboard/license" active-class="menu-active">
              <KeyRound class="w-4 h-4" />
              我的 License
            </router-link>
          </li>
          <li>
            <router-link to="/dashboard/devices" active-class="menu-active">
              <Monitor class="w-4 h-4" />
              我的设备
            </router-link>
          </li>
          <li>
            <router-link to="/dashboard/account" active-class="menu-active">
              <Settings class="w-4 h-4" />
              账户设置
            </router-link>
          </li>
        </ul>

        <!-- 底部用户区 -->
        <div class="border-t border-base-300 pt-4 mt-auto space-y-3">
          <div class="px-2">
            <p class="text-sm font-medium truncate">{{ session.username || '用户' }}</p>
            <span class="badge badge-primary badge-sm mt-1">{{ session.tierDisplay }}</span>
          </div>
          <button class="btn btn-ghost btn-xs w-full justify-start gap-2" @click="handleLogout">
            <LogOut class="w-3 h-3" />
            退出登录
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>
