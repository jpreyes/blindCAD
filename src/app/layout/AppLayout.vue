<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import Toolbar from "@/app/toolbar/Toolbar.vue";
import CommandLine from "@/app/command-line/CommandLine.vue";
import RightPanel from "@/app/panels/RightPanel.vue";
import CadViewer from "@/app/panels/CadViewer.vue";
import { registry } from "@/cad-core/command-registry";
import { commandBus } from "@/cad-core/command-bus";
import type { CommandGroup } from "@/cad-core/command-types";

const menuDefs: { label: string; group: CommandGroup }[] = [
  { label: "File", group: "file" },
  { label: "Draw", group: "draw" },
  { label: "Modify", group: "modify" },
  { label: "Annotate", group: "annotate" },
  { label: "View", group: "view" },
  { label: "Snaps", group: "snaps" },
  { label: "Blocks", group: "blocks" },
  { label: "Layout", group: "layout" },
  { label: "Structural", group: "structural" },
];

const activeMenu = ref<CommandGroup | null>(null);
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

const menus = computed(() => {
  void registryVersion.value;
  return menuDefs.map((m) => ({ ...m, commands: registry.listByGroup(m.group) }));
});

function toggleMenu(group: CommandGroup): void {
  activeMenu.value = activeMenu.value === group ? null : group;
}

function runCommand(id: string): void {
  activeMenu.value = null;
  void commandBus.run(id);
}
</script>

<template>
  <div class="app-layout">
    <header class="top-menu">
      <span class="brand">blindCAD</span>
      <nav class="menus">
        <div class="menu" v-for="m in menus" :key="m.group">
          <button class="menu-item" type="button" @click="toggleMenu(m.group)">
            {{ m.label }}
          </button>
          <div class="menu-dropdown" v-if="activeMenu === m.group">
            <button
              v-for="cmd in m.commands"
              :key="cmd.id"
              class="menu-command"
              type="button"
              :title="cmd.tooltip ?? cmd.label"
              @click="runCommand(cmd.id)"
            >
              <span>{{ cmd.label }}</span>
              <code>{{ cmd.id }}</code>
            </button>
            <div class="menu-empty" v-if="m.commands.length === 0">Sin comandos</div>
          </div>
        </div>
      </nav>
    </header>

    <div class="body">
      <Toolbar />
      <main class="canvas">
        <CadViewer />
      </main>
      <RightPanel />
    </div>

    <footer>
      <CommandLine />
    </footer>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.top-menu {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 32px;
  padding: 0 10px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
}
.brand {
  font-weight: 600;
  color: var(--accent);
}
.menus {
  display: flex;
  gap: 4px;
  height: 100%;
  align-items: center;
}
.menu {
  position: relative;
}
.menu-item {
  height: 26px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-dim);
}
.menu-item:hover {
  color: var(--text);
  background: var(--bg-elevated);
  border-color: var(--border);
}
.menu-dropdown {
  position: absolute;
  top: 29px;
  left: 0;
  z-index: 30;
  min-width: 210px;
  max-height: min(70vh, 560px);
  overflow-y: auto;
  padding: 6px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 12px 30px rgb(0 0 0 / 35%);
}
.menu-command {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 12px;
  padding: 7px 8px;
  border-radius: 4px;
  text-align: left;
}
.menu-command:hover {
  background: var(--bg-elevated);
  border-color: var(--border);
}
.menu-command code {
  color: var(--text-dim);
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 10px;
}
.menu-empty {
  padding: 8px;
  color: var(--text-dim);
  font-size: 12px;
}
.body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.canvas {
  flex: 1;
  position: relative;
  background: var(--bg);
  overflow: hidden;
}
</style>
