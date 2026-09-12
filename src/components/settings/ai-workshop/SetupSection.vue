<script setup lang="ts">
import PanelHeader from '@/components/ui/panel/PanelHeader.vue'

const { heading, description } = defineProps<{ heading: string; description?: string }>()
</script>

<template>
  <section class="flex flex-col gap-2">
    <PanelHeader
      :ui="{
        root: 'px-0 border-b-0 grid-cols-[minmax(0,1fr)_auto]',
        icon: 'hidden',
        title: 'text-xs font-semibold'
      }"
    >
      <h2>{{ heading }}</h2>
      <template v-if="$slots.action" #actions><slot name="action" /></template>
    </PanelHeader>
    <p v-if="description" class="text-[11px] text-muted">{{ description }}</p>
    <slot />
  </section>
</template>
