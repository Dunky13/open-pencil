<script setup lang="ts">
const { heading, description } = defineProps<{ heading: string; description?: string }>()
</script>
<template>
  <section class="flex flex-col gap-2">
    <header class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-xs font-semibold text-surface">{{ heading }}</h2>
        <p v-if="description" class="mt-1 text-[11px] text-muted">{{ description }}</p>
      </div>
      <slot name="action" />
    </header>
    <slot />
  </section>
</template>
