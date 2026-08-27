<script setup lang="ts">
import SiteBeianBar from '@/components/site/SiteBeianBar.vue'
</script>

<template>
  <div class="page-col">
    <div class="auth-wrap">
      <router-view />
    </div>
    <SiteBeianBar />
  </div>
</template>
