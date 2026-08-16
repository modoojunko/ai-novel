<script setup lang="ts">
import AppCard from '@/components/ui/AppCard.vue'
import AppButton from '@/components/ui/AppButton.vue'

interface Plan {
  tier: string
  label: string
  price: string
  unit: string
  features: string[]
  cta: string
  ctaVariant: 'primary' | 'outline'
  badge: string
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
    badge: 'badge-ghost', ctaTo: '/register',
  },
  {
    tier: 'monthly', label: '月付', price: '—', unit: '/月',
    features: ['30 天有效期', '3 台设备', '全功能'],
    cta: '去淘宝购买', ctaVariant: 'outline',
    badge: '', ctaHref: 'https://shop.taobao.com',
  },
  {
    tier: 'quarterly', label: '季付', price: '—', unit: '/季',
    features: ['90 天有效期', '3 台设备', '约 ¥X/月'],
    cta: '去淘宝购买', ctaVariant: 'primary',
    badge: 'badge-primary', badgeText: '最受欢迎', highlighted: true,
    ctaHref: 'https://shop.taobao.com',
  },
  {
    tier: 'yearly', label: '年付', price: '—', unit: '/年',
    features: ['365 天有效期', '5 台设备', '约 ¥X/月，最划算'],
    cta: '去淘宝购买', ctaVariant: 'outline',
    badge: '', ctaHref: 'https://shop.taobao.com',
  },
  {
    tier: 'lifetime', label: '永久', price: '—', unit: '一次买断',
    features: ['永久有效', '不限设备数', '终身更新'],
    cta: '去淘宝购买', ctaVariant: 'outline',
    badge: 'badge-accent', badgeText: '永久',
    ctaHref: 'https://shop.taobao.com',
  },
]
</script>

<template>
  <section id="pricing" class="py-16 lg:py-24">
    <h2 class="font-display text-3xl font-bold text-center">选择适合你的套餐</h2>
    <p class="text-center text-base-content/60 mt-2 mb-12">淘宝购码，一键激活</p>

    <!-- 响应式卡片布局 -->
    <div class="flex flex-wrap justify-center gap-4 lg:grid lg:grid-cols-5 lg:gap-4">
      <div
        v-for="plan in plans"
        :key="plan.tier"
        class="w-[calc(50%-0.5rem)] sm:w-[calc(50%-0.5rem)] lg:w-auto max-lg:max-w-xs"
      >
        <AppCard
          :highlighted="plan.highlighted"
          class="flex flex-col h-full"
          :class="{ 'lg:scale-105': plan.highlighted }"
        >
          <span v-if="plan.badge" class="badge self-start" :class="plan.badge">
            {{ plan.badgeText || plan.label }}
          </span>

          <div class="font-display text-4xl font-bold mt-2">
            {{ plan.price }}
            <span class="text-base font-normal text-base-content/50">{{ plan.unit }}</span>
          </div>

          <ul class="text-sm text-base-content/70 space-y-2 my-4 grow">
            <li v-for="f in plan.features" :key="f">✓ {{ f }}</li>
          </ul>

          <AppButton
            :variant="plan.ctaVariant"
            block
            :to="plan.ctaTo"
            :href="plan.ctaHref"
          >
            {{ plan.cta }}
          </AppButton>
        </AppCard>
      </div>
    </div>
  </section>
</template>
