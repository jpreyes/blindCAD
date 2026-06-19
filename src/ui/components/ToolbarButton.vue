<script setup lang="ts">
/**
 * Botón de toolbar. NO implementa lógica de comando.
 * Solo llama a commandBus.run(ID), como exige AGENTS.md.
 */
import { commandBus } from "@/cad-core/command-bus";

const props = defineProps<{
  commandId: string;
  label: string;
  icon?: string;
  tooltip?: string;
}>();

function onClick(): void {
  void commandBus.run(props.commandId);
}
</script>

<template>
  <button
    class="toolbar-btn"
    :title="tooltip ?? label"
    :aria-label="label"
    @click="onClick"
  >
    <span class="tb-icon" v-if="icon">{{ icon }}</span>
    <span class="tb-label" v-else>{{ label }}</span>
  </button>
</template>

<style scoped>
.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 34px;
  padding: 0 8px;
  border-radius: 4px;
  gap: 6px;
}
.toolbar-btn:hover {
  background: var(--bg-elevated);
  border-color: var(--border);
}
.tb-icon {
  font-size: 12px;
  color: var(--text-dim);
  text-transform: lowercase;
}
.tb-label {
  font-size: 11px;
}
</style>
