<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { commandBus } from "@/cad-core/command-bus";

interface LayerRow {
  name: string;
  isOff: boolean;
  color: number;
}

const layers = ref<LayerRow[]>([]);
let unsub: (() => void) | null = null;

onMounted(() => {
  // Refrescar capas tras cualquier comando (el historial cambia).
  unsub = commandBus.subscribe(() => refresh());
  refresh();
});

onBeforeUnmount(() => {
  unsub?.();
});

function refresh(): void {
  // El adapter se inyecta en el bus al iniciar el visor; accedemos al estado
  // del bus para saber si está listo. Para listar capas usamos commandBus.run
  // indirectamente: aquí leemos el adapter via una llamada ligera.
  // Simplificación: listamos leyendo del singleton del adapter.
  import("@/cad-adapters/cad-viewer/cad-viewer-adapter-impl").then((m) => {
    const adapter = m.cadViewerAdapter;
    if (!adapter.ready) return;
    layers.value = adapter.listLayers();
  });
}

function toggleVisible(layer: LayerRow): void {
  import("@/cad-adapters/cad-viewer/cad-viewer-adapter-impl").then((m) => {
    const adapter = m.cadViewerAdapter;
    if (!adapter.ready) return;
    adapter.setLayerVisible(layer.name, layer.isOff);
    refresh();
    commandBus.log(`Layer ${layer.name}: ${layer.isOff ? "ON" : "OFF"}`);
  });
}

function setActive(layer: LayerRow): void {
  import("@/cad-adapters/cad-viewer/cad-viewer-adapter-impl").then((m) => {
    const adapter = m.cadViewerAdapter;
    if (!adapter.ready) return;
    adapter.setCurrentLayer(layer.name);
    commandBus.log(`Capa actual: ${layer.name}`);
  });
}

function colorHex(c: number): string {
  return `#${(c & 0xffffff).toString(16).padStart(6, "0")}`;
}
</script>

<template>
  <div class="layers-panel">
    <button class="layers-add" @click="() => commandBus.run('LAYER')">
      + Capas estructurales
    </button>
    <div class="layers-list">
      <div class="layer-row" v-for="l in layers" :key="l.name">
        <button
          class="layer-bulb"
          :class="{ off: l.isOff }"
          :title="l.isOff ? 'Mostrar' : 'Ocultar'"
          @click="toggleVisible(l)"
        />
        <span class="layer-color" :style="{ background: colorHex(l.color) }" />
        <span class="layer-name" @click="setActive(l)" :title="'Establecer como actual'">
          {{ l.name }}
        </span>
      </div>
      <p class="layers-empty" v-if="layers.length === 0">
        Sin capas. Abre un dibujo o crea las estructurales.
      </p>
    </div>
  </div>
</template>

<style scoped>
.layers-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
}
.layers-add {
  padding: 4px 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 4px;
  text-align: left;
}
.layers-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 50vh;
  overflow-y: auto;
}
.layer-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
}
.layer-bulb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  border: none;
  padding: 0;
  cursor: pointer;
}
.layer-bulb.off {
  background: var(--text-dim);
}
.layer-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid var(--border);
}
.layer-name {
  cursor: pointer;
  color: var(--text);
}
.layer-name:hover {
  color: var(--accent);
}
.layers-empty {
  color: var(--text-dim);
  margin: 4px 0;
}
</style>
