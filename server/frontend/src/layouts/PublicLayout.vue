<script setup lang="ts">
import { onMounted } from 'vue'
import { useSessionStore } from '@/stores/session'
import AppButton from '@/components/ui/AppButton.vue'

const session = useSessionStore()

onMounted(() => {
  // 从 sessionStore 预取用户信息（如果有 token 的话）
  if (session.isLoggedIn && !session.userFetched) {
    session.fetchUserInfo()
  }
})
</script>

<template>
  <header class="mkt-nav">
    <div class="mkt-nav-in">
      <router-link to="/" class="mkt-logo">
        <span class="logo-mark">爱</span>
        爱<span>小说</span>
      </router-link>
      <nav class="mkt-navlinks">
        <a href="#features" class="nl">功能</a>
        <a href="#roadmap" class="nl">路线图</a>
        <a href="#pricing" class="nl">套餐</a>
        <a href="#guide" class="nl">激活指南</a>
      </nav>
      <div class="mkt-acts">
        <template v-if="session.isLoggedIn">
          <AppButton to="/dashboard" size="sm">我的账号</AppButton>
        </template>
        <template v-else>
          <AppButton to="/login" variant="ghost" size="sm">登录</AppButton>
          <AppButton to="/register" size="sm">注册</AppButton>
        </template>
      </div>
    </div>
  </header>

  <main>
    <router-view />
  </main>
</template>

<style scoped>
/* 品牌文案「小说」着 accent；:not 防命中同为 span 的 .logo-mark
   （其 白字 规则特异性 (0,1,0) 会被本规则 (0,2,1) 压掉，glyph 隐形） */
.mkt-logo span:not(.logo-mark) {
  color: var(--accent);
  font-weight: inherit;
}
</style>
