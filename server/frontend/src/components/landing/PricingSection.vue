<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'
import { apiPaySkus, type SkuItem } from '@/api/pay'

/**
 * 套餐卡 = 收银台同源数据（GET /pay/skus 公开商品目录）。
 * 价格/折扣/"最受欢迎"全部跟数据库 SKU 配置走，本组件不再写死数字；
 * 目录不可达或停售时价格留白（"价格见收银台"），结构性权益（时长/设备数）仍展示。
 */
interface PlanCard {
  key: string
  label: string
  price: string
  basePrice: string
  discount: string
  unit: string
  features: string[]
  badge?: string
  highlighted?: boolean
  cta: string
  ctaVariant: 'primary' | 'outline'
  ctaTo?: string
}

const PERIOD_META: Record<string, { label: string; unit: string }> = {
  monthly: { label: '月付', unit: '/月' },
  quarterly: { label: '季付', unit: '/季' },
  yearly: { label: '年付', unit: '/年' },
}
const PERIOD_ORDER = Object.keys(PERIOD_META)

/** 分 → 元展示：去尾零（¥30 / ¥239.2），值与收银台 fenToYuan 精确一致 */
const yuan = (fen: number) => `¥${(fen / 100).toFixed(2).replace(/\.?0+$/, '')}`

const trialCard: PlanCard = {
  key: 'trial', label: '试用', price: '¥0', basePrice: '', discount: '', unit: '/7天',
  features: ['全功能体验', '1 台设备', '7 天有效期'],
  cta: '注册领取', ctaVariant: 'primary', ctaTo: '/register',
}

// 目录不可达时的降级骨架：时长/设备数是产品结构事实，与 TIER_POLICY 对齐；价格一律留白
const FALLBACK_PAID: PlanCard[] = (
  [
    ['monthly', 30, 3], ['quarterly', 90, 3], ['yearly', 365, 5],
  ] as const
).map(([period, days, devices]) => ({
  key: period,
  label: PERIOD_META[period].label,
  price: '', basePrice: '', discount: '', unit: PERIOD_META[period].unit,
  features: [`${days} 天有效期`, `${devices} 台设备`, '全功能'],
  cta: '去购买', ctaVariant: 'outline', ctaTo: '/pay',
}))

const paidSkus = ref<SkuItem[]>([])
const popularSku = ref('')
const storeOpen = ref(false)

onMounted(async () => {
  try {
    const v = await apiPaySkus()
    paidSkus.value = [...v.skus].sort(
      (a, b) => PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period),
    )
    popularSku.value = v.popular_sku
    storeOpen.value = v.purchase_enabled
  } catch {
    // 保持降级骨架
  }
})

const paidCards = computed<PlanCard[]>(() => {
  if (!paidSkus.value.length) return FALLBACK_PAID
  return paidSkus.value.map((s) => {
    const meta = PERIOD_META[s.period] ?? { label: s.period, unit: '' }
    const popular = storeOpen.value && s.sku_key === popularSku.value
    const off = storeOpen.value && !!s.discount_display
    return {
      key: s.sku_key,
      label: meta.label,
      price: storeOpen.value ? yuan(s.price_fen) : '',
      basePrice: off ? yuan(s.base_price_fen) : '',
      discount: off ? s.discount_display : '',
      unit: meta.unit,
      features: [`${s.period_days} 天有效期`, `${s.device_limit} 台设备`, '全功能'],
      badge: popular ? '最受欢迎' : undefined,
      highlighted: popular,
      cta: '立即购买',
      ctaVariant: popular ? 'primary' : 'outline',
      ctaTo: '/pay',
    }
  })
})

const cards = computed(() => [trialCard, ...paidCards.value])
</script>

<template>
  <section id="pricing" class="mkt-section">
    <div class="mkt-in">
      <div class="mb-12 text-center">
        <span class="mkt-eyebrow">套餐</span>
        <h2 class="mkt-h2">选择适合你的套餐</h2>
        <p class="mkt-lead max-w-lg mx-auto">微信扫码支付，支付成功套餐立即到账</p>
      </div>

      <div class="plans-grid">
        <div
          v-for="plan in cards"
          :key="plan.key"
          class="mkt-plan"
          :class="plan.highlighted ? 'pro' : 'free'"
        >
          <span v-if="plan.badge" class="mkt-pro-pill">{{ plan.badge }}</span>
          <h3>{{ plan.label }}</h3>
          <div class="price num">
            <template v-if="plan.price">
              {{ plan.price }}<span class="unit">{{ plan.unit }}</span>
              <span v-if="plan.basePrice" class="price-was num">{{ plan.basePrice }}</span>
              <span v-if="plan.discount" class="price-off">{{ plan.discount }}</span>
            </template>
            <span v-else class="unit">价格见收银台</span>
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
          >
            {{ plan.cta }}
          </AppButton>
        </div>
      </div>
    </div>
  </section>
</template>
