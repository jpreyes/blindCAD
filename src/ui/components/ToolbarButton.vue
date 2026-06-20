<script setup lang="ts">
/**
 * Botón de toolbar. NO implementa lógica de comando.
 * Solo llama a commandBus.run(ID), como exige AGENTS.md.
 */
import { commandBus } from "@/cad-core/command-bus";
import { computed } from "vue";

const props = defineProps<{
  commandId: string;
  label: string;
  icon?: string;
  tooltip?: string;
}>();

function onClick(): void {
  void commandBus.run(props.commandId);
}

const mnemonic = computed(() =>
  props.commandId
    .split("_")
    .map((part) => part[0])
    .join("")
    .slice(0, 3),
);
</script>

<template>
  <button
    class="toolbar-btn"
    :title="tooltip ?? label"
    :aria-label="label"
    @click="onClick"
  >
    <span class="tb-icon">{{ mnemonic }}</span>
    <span class="tb-text">
      <span class="tb-label">{{ label }}</span>
      <span class="tb-command">{{ commandId }}</span>
    </span>
  </button>
</template>

<style scoped>
.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  min-height: 34px;
  padding: 4px 6px;
  border-radius: 4px;
  gap: 6px;
  text-align: left;
}
.toolbar-btn:hover {
  background: var(--bg-elevated);
  border-color: var(--border);
}
.tb-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 28px;
  height: 24px;
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.3px;
}
.tb-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.15;
}
.tb-label {
  color: var(--text);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tb-command {
  color: var(--text-dim);
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 9px;
}
</style>
