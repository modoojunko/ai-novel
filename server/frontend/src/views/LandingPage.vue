<script setup lang="ts">
import HeroSection from '@/components/landing/HeroSection.vue'
import ConceptSection from '@/components/landing/ConceptSection.vue'
import FeaturesSection from '@/components/landing/FeaturesSection.vue'
import RoadmapSection from '@/components/landing/RoadmapSection.vue'
import PricingSection from '@/components/landing/PricingSection.vue'
import ActivationGuideSection from '@/components/landing/ActivationGuideSection.vue'
import FaqSection from '@/components/landing/FaqSection.vue'
import FooterSection from '@/components/landing/FooterSection.vue'
</script>

<template>
  <div>
    <div class="max-w-5xl mx-auto px-6">
      <HeroSection />
    </div>
    <!-- 全宽横幅：核心叙事与路线图预告 -->
    <ConceptSection />
    <div class="max-w-5xl mx-auto px-6">
      <FeaturesSection />
    </div>
    <RoadmapSection />
    <div class="max-w-5xl mx-auto px-6">
      <PricingSection />
      <ActivationGuideSection />
      <FaqSection />
      <FooterSection />
    </div>
  </div>
</template>
