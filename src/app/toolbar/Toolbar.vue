<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { registry } from "@/cad-core/command-registry";
import type { CommandGroup } from "@/cad-core/command-types";
import ToolbarButton from "@/ui/components/ToolbarButton.vue";

const groups: CommandGroup[] = ["file", "draw", "modify", "view", "annotate", "snaps", "blocks", "layout", "structural"];
const registryVersion = ref(0);
let unsubscribe: (() => void) | null = null;

onMounted(() => {
  unsubscribe = registry.subscribe(() => {
    registryVersion.value++;
  });
});

onBeforeUnmount(() => {
  unsubscribe?.();
});

const grouped = computed(() =>
  groups
    .map((g) => {
      void registryVersion.value;
      return { group: g, commands: registry.listByGroup(g) };
    })
    .filter((sec) => sec.commands.length > 0),
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
  gap: 8px;
  padding: 8px 6px;
  width: 164px;
  background: var(--bg-panel);
  border-right: 1px solid var(--border);
  overflow-y: auto;
}
.tb-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tb-group-label {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--text-dim);
  letter-spacing: 0.5px;
  margin: 4px 4px 2px;
}
</style>
