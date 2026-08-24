<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import AppCard from '@/components/ui/AppCard.vue'
import AppButton from '@/components/ui/AppButton.vue'

const session = useSessionStore()

const daysRemaining = computed(() => {
  if (session.tier === 'lifetime') return Infinity
  if (!session.expiresAt) return 0
  const now = new Date()
  const exp = new Date(session.expiresAt)
  return Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / 86400000))
})

const emit = defineEmits<{
  activate: []
}>()
</script>

<template>
  <AppCard class="lic" :class="{ expired: !session.isValid && session.tier !== 'none' }">
    <div class="panel-h">
      <div class="title-row">
        <h3>{{ session.tierDisplay }}</h3>
        <span v-if="session.isValid" class="b ok">有效期内</span>
        <span v-else-if="session.tier !== 'none'" class="b err">已过期</span>
      </div>
      <AppButton variant="primary" @click="$emit('activate')">
        激活新码
      </AppButton>
    </div>

    <div class="stat-tiles two">
      <div class="stat">
        <div class="k">到期日</div>
        <div class="v num">{{ session.expiresAt ? session.expiresAt.slice(0, 10) : '—' }}</div>
      </div>
      <div class="stat">
        <div class="k">剩余天数</div>
        <div class="v num">
          <template v-if="session.tier === 'none'">—</template>
          <template v-else-if="daysRemaining === Infinity">永久</template>
          <template v-else>{{ daysRemaining }}<small>天</small></template>
        </div>
      </div>
    </div>
  </AppCard>
</template>

<style scoped>
.lic.expired { border-left: 3px solid var(--err); }
.title-row { display: flex; align-items: center; gap: 10px; }
h3 { font-family: var(--font-display); font-size: 19px; font-weight: 600; margin: 0; }
.stat-tiles.two { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 0; }
</style>
