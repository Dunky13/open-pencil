<script setup lang="ts">
import AppSelect from '@/components/ui/select/AppSelect.vue'
const { label, description, options, detail } = defineProps<{
  label: string
  description?: string
  options: { value: string; label: string }[]
  detail?: string
}>()
const model = defineModel<string>({ required: true })
</script>
<template>
  <div class="grid items-start gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,280px)] sm:gap-6">
    <div>
      <p class="text-xs font-medium text-surface">{{ label }}</p>
      <p v-if="description" class="mt-1 text-[11px] leading-relaxed text-muted">
        {{ description }}
      </p>
    </div>
    <div class="min-w-0">
      <AppSelect
        v-model="model"
        :label="label"
        :options="[{ value: '__none__', label: 'Not configured' }, ...options]"
      />
      <p v-if="detail" class="mt-1.5 text-[11px] text-muted">{{ detail }}</p>
      <slot />
    </div>
  </div>
</template>
