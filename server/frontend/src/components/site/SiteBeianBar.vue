<script setup lang="ts">
import { siteBeian, hasBeianInfo } from '@/constants/site-beian'
</script>

<template>
  <!-- 全站统一备案信息条；两段皆空整条隐藏，不留占位空壳 -->
  <footer v-if="hasBeianInfo" class="beian-bar">
    <a
      v-if="siteBeian.icp"
      :href="siteBeian.miitUrl"
      target="_blank"
      rel="noopener"
    >{{ siteBeian.icp }}</a>
    <a
      v-if="siteBeian.police"
      :href="siteBeian.policeUrl"
      target="_blank"
      rel="noopener"
    >{{ siteBeian.police }}</a>
  </footer>
</template>

<style scoped>
/* 字级对齐 FooterSection 的 .foot-cr 体系：12px + muted 混色 */
.beian-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 18px;
  padding: 12px 24px;
  font-size: 12px;
  color: color-mix(in oklch, var(--muted) 70%, transparent);
}
.beian-bar a { color: inherit; text-decoration: none; }
.beian-bar a:hover { color: var(--fg); }
</style>
