<script setup lang="ts">
import { ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useDeviceStore } from '@/stores/devices'
import { usePageLoad } from '@/composables/usePageLoad'
import LicenseCard from '@/components/dashboard/LicenseCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppModal from '@/components/ui/AppModal.vue'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton.vue'
import ActivateCodeForm from '@/components/dashboard/ActivateCodeForm.vue'
import Ico from '@/components/ui/Ico.vue'
import { P } from '@/components/ui/icons'

const session = useSessionStore()
const deviceStore = useDeviceStore()

const showActivateModal = ref(false)
const { loadError, retry } = usePageLoad(() => Promise.all([
  session.fetchUserInfo(),
  deviceStore.fetchDevices(),
]))
</script>

<template>
  <div class="page-col">
    <!-- 欢迎行 -->
    <div class="page-head">
      <div>
        <h1>首页</h1>
        <p class="sub">欢迎回来，{{ session.username || '用户' }}</p>
      </div>
    </div>

    <!-- 加载态 -->
    <LoadingSkeleton v-if="session.isLoading && !loadError" variant="license" />

    <!-- 错误态 -->
    <div v-else-if="loadError" class="err-box">
      <p>加载失败</p>
      <AppButton variant="secondary" size="sm" @click="retry">重试</AppButton>
    </div>

    <!-- 内容区 -->
    <template v-else>
      <LicenseCard @activate="showActivateModal = true" />

      <!-- 快速操作区 -->
      <div class="quick-grid">
        <AppCard hoverable>
          <div class="quick-row">
            <div>
              <div class="qv num">
                    {{ deviceStore.activatedCount }}<small>/ {{ deviceStore.activeLimit }}</small>
              </div>
              <div class="qk">台已激活</div>
            </div>
            <router-link to="/dashboard/devices" class="lnk">
              管理设备 <Ico :d="P.arrowRight" :size="12" />
            </router-link>
          </div>
        </AppCard>

        <AppCard hoverable>
          <div class="quick-row">
            <div>
              <div class="qt serif">账户设置</div>
              <div class="qk">修改密码 · 设置密保</div>
            </div>
            <router-link to="/dashboard/account" class="lnk">
              前往设置 <Ico :d="P.arrowRight" :size="12" />
            </router-link>
          </div>
        </AppCard>
      </div>
    </template>

    <!-- 激活码模态 -->
    <AppModal v-model:open="showActivateModal" title="激活 License">
      <ActivateCodeForm />
    </AppModal>
  </div>
</template>

<style scoped>
.page-col { display: flex; flex-direction: column; gap: 20px; }
.quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.quick-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.qv { font-size: 26px; font-weight: 600; color: var(--accent-strong); }
.qv small { font-size: 12px; font-weight: 400; color: var(--muted); margin-left: 3px; }
.qt { font-size: 17px; font-weight: 600; }
.qk { font-size: 12.5px; color: var(--muted); margin-top: 4px; }
.lnk { display: inline-flex; align-items: center; gap: 3px; font-size: 13px; }
.err-box { text-align: center; padding: 48px 0; color: var(--muted); display: flex; flex-direction: column; align-items: center; gap: 12px; }
@media (max-width: 700px) { .quick-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
