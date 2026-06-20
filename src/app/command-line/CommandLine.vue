<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { commandBus } from "@/cad-core/command-bus";
import { resolveAlias } from "@/cad-core/aliases";
import { registry } from "@/cad-core/command-registry";
import type { CommandBusState } from "@/cad-core/command-bus";

const state = ref<CommandBusState>({ active: null, prompt: null, history: [] });
const input = ref("");
const historyEl = ref<HTMLDivElement | null>(null);

const quickCommands = [
  { id: "LINE", label: "Line" },
  { id: "POLYLINE", label: "Polyline" },
  { id: "RECTANGLE", label: "Rect" },
  { id: "CIRCLE", label: "Circle" },
  { id: "SELECT", label: "Select" },
  { id: "ERASE", label: "Erase" },
  { id: "MOVE", label: "Move" },
  { id: "COPY", label: "Copy" },
  { id: "ZOOM", label: "Zoom" },
  { id: "PAN", label: "Pan" },
  { id: "LAYER", label: "Layers" },
  { id: "OSNAP_ENDPOINT", label: "End" },
  { id: "OSNAP_MIDPOINT", label: "Mid" },
  { id: "OSNAP_CENTER", label: "Cen" },
] as const;

let unsub: (() => void) | null = null;

onMounted(() => {
  unsub = commandBus.subscribe((s) => {
    state.value = s;
    scrollHistory();
  });
});

onBeforeUnmount(() => {
  unsub?.();
});

function scrollHistory(): void {
  requestAnimationFrame(() => {
    if (historyEl.value) historyEl.value.scrollTop = historyEl.value.scrollHeight;
  });
}

function submit(): void {
  const raw = input.value.trim();
  input.value = "";
  if (!raw) {
    // Enter vacío repite el último comando (AutoCAD).
    void commandBus.runLast();
    return;
  }
  const upper = raw.toUpperCase();
  if (registry.get(upper) || resolveAlias(raw)) {
    void commandBus.run(raw);
  } else {
    commandBus.log(`Comando desconocido: "${raw}"`);
  }
}

function cancel(): void {
  commandBus.cancel();
  input.value = "";
  // The embedded viewer listens for keyboard cancellation during getPoint().
  // Dispatch Escape as well so the visible ESC button can abort point prompts.
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

function runQuick(id: string): void {
  void commandBus.run(id);
}
</script>

<template>
  <div class="cmdline">
    <div class="cmd-history" ref="historyEl">
      <div class="cmd-line" v-for="(line, i) in state.history" :key="i">{{ line }}</div>
    </div>
    <div class="cmd-actions">
      <button class="cmd-action danger" type="button" title="Cancel active command (Esc)" @click="cancel">
        ESC
      </button>
      <button
        v-for="cmd in quickCommands"
        :key="cmd.id"
        class="cmd-action"
        type="button"
        :title="cmd.id"
        @click="runQuick(cmd.id)"
      >
        {{ cmd.label }}
      </button>
    </div>
    <div class="cmd-input-row">
      <span class="cmd-prompt">{{ state.prompt ? state.prompt.message : "Command:" }}</span>
      <input
        class="cmd-input"
        v-model="input"
        type="text"
        spellcheck="false"
        autocomplete="off"
        @keydown.enter.prevent="submit"
        @keydown.esc.prevent="cancel"
      />
    </div>
  </div>
</template>

<style scoped>
.cmdline {
  display: flex;
  flex-direction: column;
  height: 140px;
  background: var(--bg-panel);
  border-top: 1px solid var(--border);
}
.cmd-history {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 12px;
  color: var(--text-dim);
}
.cmd-actions {
  display: flex;
  gap: 4px;
  align-items: center;
  min-height: 30px;
  padding: 3px 8px;
  border-top: 1px solid var(--border);
  overflow-x: auto;
}
.cmd-action {
  flex: 0 0 auto;
  height: 23px;
  padding: 0 8px;
  border-radius: 4px;
  border-color: var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 11px;
}
.cmd-action:hover {
  border-color: var(--accent-dim);
  color: var(--accent);
}
.cmd-action.danger {
  color: #ffaaaa;
  border-color: #5a2a2a;
}
.cmd-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-top: 1px solid var(--border);
}
.cmd-prompt {
  color: var(--accent);
  font-family: "Cascadia Code", Consolas, monospace;
  white-space: nowrap;
}
.cmd-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 12px;
}
</style>
