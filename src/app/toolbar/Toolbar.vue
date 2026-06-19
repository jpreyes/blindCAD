<script setup lang="ts">
import { computed } from "vue";
import { registry } from "@/cad-core/command-registry";
import type { CommandGroup } from "@/cad-core/command-types";
import ToolbarButton from "@/ui/components/ToolbarButton.vue";

const groups: CommandGroup[] = ["draw", "modify", "view", "annotate"];

const grouped = computed(() =>
  groups.map((g) => ({ group: g, commands: registry.listByGroup(g) })),
);
</script>

<template>
  <aside class="toolbar">
    <div class="tb-section" v-for="sec in grouped" :key="sec.group">
      <div class="tb-group-label">{{ sec.group }}</div>
      <ToolbarButton
        v-for="cmd in sec.commands"
        :key="cmd.id"
        :command-id="cmd.id"
        :label="cmd.label"
        :icon="cmd.icon"
        :tooltip="cmd.tooltip"
      />
    </div>
  </aside>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 6px;
  width: 52px;
  background: var(--bg-panel);
  border-right: 1px solid var(--border);
  overflow-y: auto;
}
.tb-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.tb-group-label {
  font-size: 9px;
  text-transform: uppercase;
  color: var(--text-dim);
  letter-spacing: 0.5px;
  margin-top: 4px;
}
</style>
