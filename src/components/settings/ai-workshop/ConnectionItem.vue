<script setup lang="ts">
import AppButton from '@/components/ui/button/AppButton.vue'
import ConnectionStatus from './ConnectionStatus.vue'
const {
  name,
  detail,
  agent = false
} = defineProps<{ name: string; detail: string; agent?: boolean }>()
const emit = defineEmits<{ manage: [] }>()
</script>
<template>
  <li
    class="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[32px_minmax(0,1fr)_auto_auto]"
  >
    <span
      class="col-start-1 row-start-1 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-input"
      aria-hidden="true"
      ><icon-lucide-terminal v-if="agent" class="size-4 text-muted" /><icon-lucide-network
        v-else
        class="size-4 text-muted"
    /></span>
    <div class="col-start-2 row-start-1 min-w-0">
      <p class="text-xs font-medium text-surface">{{ name }}</p>
      <p class="mt-0.5 text-[11px] text-muted">{{ detail }}</p>
    </div>
    <ConnectionStatus
      class="col-start-2 row-start-2 sm:col-start-3 sm:row-start-1"
      :status="agent ? 'ready' : 'connected'"
    />
    <AppButton
      class="col-start-3 row-start-1 sm:col-start-4"
      size="xs"
      variant="outline"
      :aria-label="`Manage ${name}`"
      @click="emit('manage')"
      >Manage</AppButton
    >
  </li>
</template>
