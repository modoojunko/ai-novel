import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const routes = [
  {
    path: '/',
    component: () => import('@/layouts/PublicLayout.vue'),
    children: [
      {
        path: '',
        name: 'landing',
        component: () => import('@/views/LandingPage.vue'),
      },
      {
        path: 'login',
        name: 'login',
        meta: { guestOnly: true },
        component: () => import('@/views/LoginPage.vue'),
      },
      {
        path: 'register',
        name: 'register',
        meta: { guestOnly: true },
        component: () => import('@/views/RegisterPage.vue'),
      },
    ],
  },
  {
    path: '/auth',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      { path: '', name: 'auth', component: () => import('@/views/AuthPage.vue') },
    ],
  },
  {
    path: '/dashboard',
    component: () => import('@/layouts/DashboardLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/views/dashboard/DashboardHome.vue'),
      },
      {
        path: 'license',
        name: 'license',
        component: () => import('@/views/dashboard/LicensePage.vue'),
      },
      {
        path: 'devices',
        name: 'devices',
        component: () => import('@/views/dashboard/DevicesPage.vue'),
      },
      {
        path: 'account',
        name: 'account',
        component: () => import('@/views/dashboard/AccountPage.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundPage.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  // 锚点导航（mkt-nav 的 /#features 等 router-link）依赖此行为滚动；
  // 同页点锚点（/ → /#pricing）与跨页（/login → /#features）都要滚
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  },
})

// ── 双向导航守卫 ──
router.beforeEach((to, from, next) => {
  const session = useSessionStore()

  // 正向守卫：未登录 → 跳登录
  if (to.meta.requiresAuth && !session.isLoggedIn) {
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }

  // 反向守卫：已登录访客页 → 静默跳控制台
  if (to.meta.guestOnly && session.isLoggedIn) {
    next({ name: 'dashboard' })
    return
  }

  next()
})

export default router
