<script setup lang="ts">
import Toolbar from "@/app/toolbar/Toolbar.vue";
import CommandLine from "@/app/command-line/CommandLine.vue";
import RightPanel from "@/app/panels/RightPanel.vue";
import CadViewer from "@/app/panels/CadViewer.vue";

const menus = ["File", "Edit", "View", "Draw", "Modify", "Annotate", "Structural", "Layout"];
</script>

<template>
  <div class="app-layout">
    <header class="top-menu">
      <span class="brand">blindCAD</span>
      <nav class="menus">
        <span class="menu-item" v-for="m in menus" :key="m">{{ m }}</span>
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
  gap: 14px;
}
.menu-item {
  font-size: 12px;
  color: var(--text-dim);
  cursor: default;
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
