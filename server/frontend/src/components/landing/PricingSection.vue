<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'

interface Plan {
  tier: string
  label: string
  price: string
  unit: string
  features: string[]
  cta: string
  ctaVariant: 'primary' | 'outline'
  badgeText?: string
  highlighted?: boolean
  ctaTo?: string
  ctaHref?: string
}

const plans: Plan[] = [
  {
    tier: 'trial', label: '试用', price: '¥0', unit: '/7天',
    features: ['全功能体验', '1 台设备', '7 天有效期'],
    cta: '注册领取', ctaVariant: 'primary',
    ctaTo: '/register',
  },
  {
    tier: 'monthly', label: '月付', price: '—', unit: '/月',
    features: ['30 天有效期', '3 台设备', '全功能'],
    cta: '去淘宝购买', ctaVariant: 'outline',
    ctaHref: 'https://shop.taobao.com',
  },
  {
    tier: 'quarterly', label: '季付', price: '—', unit: '/季',
    features: ['90 天有效期', '3 台设备', '约 ¥X/月'],
    cta: '去淘宝购买', ctaVariant: 'primary',
    badgeText: '最受欢迎', highlighted: true,
    ctaHref: 'https://shop.taobao.com',
  },
  {
    tier: 'yearly', label: '年付', price: '—', unit: '/年',
    features: ['365 天有效期', '5 台设备', '约 ¥X/月，最划算'],
    cta: '去淘宝购买', ctaVariant: 'outline',
    ctaHref: 'https://shop.taobao.com',
  },
  {
    tier: 'lifetime', label: '永久', price: '—', unit: '一次买断',
    features: ['永久有效', '不限设备数', '终身更新'],
    cta: '去淘宝购买', ctaVariant: 'outline',
    ctaHref: 'https://shop.taobao.com',
  },
]
</script>

<template>
  <section id="pricing" class="mkt-section">
    <div class="mkt-in">
      <div class="mb-12 text-center">
        <span class="mkt-eyebrow">套餐</span>
        <h2 class="mkt-h2">选择适合你的套餐</h2>
        <p class="mkt-lead max-w-lg mx-auto">淘宝购码，一键激活</p>
      </div>

      <div class="plans-grid">
        <div
          v-for="plan in plans"
          :key="plan.tier"
          class="mkt-plan"
          :class="plan.highlighted ? 'pro' : 'free'"
        >
          <span v-if="plan.badgeText" class="mkt-pro-pill">{{ plan.badgeText }}</span>
          <h3>{{ plan.label }}</h3>
          <div class="price num">
            {{ plan.price }}<span class="unit">{{ plan.unit }}</span>
          </div>
          <div class="feats">
            <div v-for="f in plan.features" :key="f" class="f">
              <Ico :d="P.check" :style="{ color: plan.highlighted ? 'var(--accent)' : 'var(--ok)' }" />
              {{ f }}
            </div>
          </div>
          <AppButton
            :variant="plan.ctaVariant"
            block
            :to="plan.ctaTo"
            :href="plan.ctaHref"
          >
            {{ plan.cta }}
          </AppButton>
        </div>
      </div>
    </div>
  </section>
</template>
