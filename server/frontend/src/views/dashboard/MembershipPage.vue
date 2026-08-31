<script setup lang="ts">
/**
 * 我的套餐——权益总览（时间线+待激活区块+设备额度）。
 * 设计事实源：docs/design-s/prototypes/membership.html
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiPayMembership, type MembershipView } from '@/api/pay'

const router = useRouter()
const loading = ref(true)
const data = ref<MembershipView | null>(null)

onMounted(async () => {
  try {
    data.value = await apiPayMembership()
  } catch (e) {
    console.error('membership load failed:', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="membership-page">
    <div class="page-head">
      <div>
        <h1>我的套餐</h1>
        <div class="sub">已购套餐的使用情况与时长都在这里。</div>
      </div>
      <button class="btn btn-primary" @click="router.push('/pay')">续费或购买时长</button>
    </div>

    <div v-if="loading" class="loading">加载中…</div>

    <template v-else-if="data">
      <!-- 档位头 -->
      <div class="panel">
        <div class="panel-h">
          <div class="tier-hero">
            <span class="tier-name">{{ data.tier === 'trial' ? '试用' : data.tier === 'pro' ? 'PRO' : data.tier === 'max' ? 'MAX' : '免费' }}</span>
            <span v-if="data.remaining_sec > 0" class="pill pill-ok">生效中</span>
            <span v-else class="pill pill-tag">已到期</span>
          </div>
          <span class="sum">
            <span>剩余 <b>{{ data.remaining_desc }}</b></span>
            <span v-if="data.max_expires_at">最远到期 <b>{{ data.max_expires_at.slice(0, 10) }}</b></span>
            <span v-if="data.pending_count > 0">待激活 <b>{{ data.pending_count }} 个</b></span>
          </span>
        </div>
      </div>

      <!-- 空态 -->
      <div v-if="data.remaining_sec <= 0 && data.pending_count === 0" class="empty">
        <div class="serif">还没有生效中的套餐</div>
        <p>购买套餐后，使用情况与时长明细会展示在这里。</p>
        <button class="btn btn-primary" @click="router.push('/pay')">去看看套餐</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.membership-page { max-width: 720px; margin: 0 auto; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.page-head h1 { font-family: var(--font-display); font-size: 26px; font-weight: 600; margin: 0; }
.page-head .sub { font-size: 13px; color: var(--muted); margin-top: 6px; }
.loading { padding: 60px; text-align: center; color: var(--muted); }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px 22px; }
.panel-h { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.tier-hero { display: flex; align-items: center; gap: 10px; }
.tier-name { font-family: var(--font-display); font-size: 22px; font-weight: 600; }
.sum { display: flex; gap: 16px; font-size: 12.5px; color: var(--muted); }
.sum b { color: var(--fg); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.empty { border: 1px dashed var(--border); border-radius: var(--radius-lg); padding: 64px 32px; text-align: center; color: var(--muted); margin-top: 14px; }
.empty .serif { font-family: var(--font-display); font-size: 19px; color: var(--fg); }
.empty p { margin: 8px 0 0; font-size: 13.5px; }
.empty .btn { margin-top: 16px; }
</style>
