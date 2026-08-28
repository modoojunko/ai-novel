<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { apiAuthorize } from '@/api/client'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'

const route = useRoute()

const pcHash = ref('')
const deviceProfile = ref('')
const username = ref('')
const password = ref('')
const isSubmitting = ref(false)
const authorized = ref(false)
const errorMsg = ref('')
const authResult = ref<{ tier: string; expires_at: string }>({ tier: '', expires_at: '' })
const isInvalid = ref(false)

onMounted(() => {
  pcHash.value = (route.query.pc_hash as string) || ''
  deviceProfile.value = (route.query.device_profile as string) || ''
  if (!pcHash.value) {
    isInvalid.value = true
  }
})

async function submitAuth() {
  if (!username.value || !password.value) return
  isSubmitting.value = true
  errorMsg.value = ''

  try {
    const res = await apiAuthorize(
      username.value,
      password.value,
      pcHash.value,
      undefined,
      deviceProfile.value || undefined,
    )
    if (res.code === 0) {
      authorized.value = true
      authResult.value = {
        tier: res.data?.tier || '',
        expires_at: res.data?.expires_at || '',
      }
    } else {
      errorMsg.value = res.msg || '授权失败'
    }
  } catch (e: any) {
    if (e.message?.includes('429') || e.message?.includes('过于频繁')) {
      errorMsg.value = '操作过于频繁，请 1 分钟后重试'
    } else {
      errorMsg.value = e.message || '网络错误'
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="auth-card wide">
    <!-- 无效请求 -->
    <template v-if="isInvalid">
      <p class="notice warn">
        <Ico :d="P.alert" />无效的授权请求，请从桌面应用重新发起
      </p>
    </template>

    <!-- 授权成功 -->
    <template v-else-if="authorized">
      <div class="ok-wrap">
        <span class="ok-ring"><Ico :d="P.check" :sw="2.2" /></span>
        <h1>授权成功</h1>
        <div class="ok-meta">
          <span class="pill pill-status pill-ok">{{ authResult.tier }}</span>
          <span v-if="authResult.expires_at" class="pill pill-tag num">
            {{ authResult.expires_at.slice(0, 10) }} 到期
          </span>
        </div>
        <p class="ok-note">此页面可以关闭了</p>
      </div>
    </template>

    <!-- 授权表单 -->
    <template v-else>
      <div class="brand-row">
        <span class="logo-mark">爱</span>
        <span class="bn serif">爱小说</span>
      </div>
      <h1>设备授权</h1>
      <p class="sub">桌面应用请求绑定此设备，请登录以完成授权</p>

      <p v-if="errorMsg" class="notice err">
        <Ico :d="P.alert" />{{ errorMsg }}
      </p>

      <div class="form-area">
        <AppInput v-model="username" label="用户名" />
        <AppInput v-model="password" type="password" label="密码" />

        <AppButton
          variant="primary"
          size="lg"
          block
          :loading="isSubmitting"
          :disabled="!username || !password"
          @click="submitAuth"
        >
          授权登录
        </AppButton>
      </div>

      <p class="foot-lnk">
        <router-link to="/register" class="lnk">还没有账号？注册</router-link>
      </p>
    </template>
  </div>
</template>

<style scoped>
.auth-card.wide { max-width: 400px; text-align: center; }
.brand-row { display: flex; align-items: center; justify-content: center; gap: 9px; margin-bottom: 18px; }
.brand-row .bn { font-size: 17px; font-weight: 600; }
h1 { font-family: var(--font-display); font-size: 26px; font-weight: 600; margin: 0; }
.sub { font-size: 13.5px; color: var(--muted); margin: 4px 0 22px; line-height: 1.7; }
.form-area { text-align: left; }
.form-area .btn { margin-top: 6px; }
.foot-lnk { font-size: 13px; margin: 16px 0 0; }
.ok-wrap { padding: 12px 0 4px; }
.ok-ring { width: 56px; height: 56px; border-radius: 999px; background: var(--ok-soft); color: var(--ok); display: grid; place-items: center; margin: 0 auto 16px; }
.ok-ring svg { width: 26px; height: 26px; }
.ok-meta { display: flex; justify-content: center; gap: 8px; margin-top: 12px; }
.ok-note { font-size: 12px; color: var(--muted); margin: 24px 0 0; }
</style>
