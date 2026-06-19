<script setup lang="ts">
import { ref } from "vue";

const tabs = ["Properties", "Layers", "Blocks"] as const;
const active = ref<(typeof tabs)[number]>("Layers");
</script>

<template>
  <aside class="right-panel">
    <div class="rp-tabs">
      <button
        v-for="t in tabs"
        :key="t"
        :class="['rp-tab', { active: active === t }]"
        @click="active = t"
      >
        {{ t }}
      </button>
    </div>
    <div class="rp-body">
      <p class="rp-empty">{{ active }}: panel placeholder (paso posterior).</p>
    </div>
  </aside>
</template>

<style scoped>
.right-panel {
  display: flex;
  flex-direction: column;
  width: 240px;
  background: var(--bg-panel);
  border-left: 1px solid var(--border);
}
.rp-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
}
.rp-tab {
  flex: 1;
  padding: 6px;
  font-size: 11px;
  border-bottom: 2px solid transparent;
}
.rp-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
.rp-body {
  padding: 8px;
  color: var(--text-dim);
}
.rp-empty {
  margin: 0;
  font-size: 11px;
}
</style>
