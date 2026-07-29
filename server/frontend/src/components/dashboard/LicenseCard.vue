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
  <AppCard :class="{ 'border-l-4 border-error': !session.isValid && session.tier !== 'none' }">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <h3 class="font-display text-xl font-bold">{{ session.tierDisplay }}</h3>
          <span
            v-if="session.isValid"
            class="badge badge-success badge-sm"
          >
            有效期内
          </span>
          <span
            v-else-if="session.tier !== 'none'"
            class="badge badge-error badge-sm"
          >
            已过期
          </span>
        </div>

        <p class="text-sm text-base-content/60">
          <template v-if="session.expiresAt">
            到期日：{{ session.expiresAt.slice(0, 10) }}
          </template>
          <template v-else>
            未激活
          </template>
        </p>

        <div v-if="session.tier !== 'none'" class="font-display text-3xl font-bold text-primary">
          <template v-if="daysRemaining === Infinity">
            永久有效
          </template>
          <template v-else>
            {{ daysRemaining }} <span class="text-base font-normal text-base-content/60">天后到期</span>
          </template>
        </div>
      </div>

      <AppButton variant="primary" @click="$emit('activate')">
        激活新码
      </AppButton>
    </div>
  </AppCard>
</template>
