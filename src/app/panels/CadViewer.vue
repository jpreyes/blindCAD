<script setup lang="ts">
/**
 * CadViewer: monta el componente MlCadViewer (@mlightcad/cad-viewer) como
 * motor de visualización/carga, con SU UI oculta.
 *
 * Principio AGENTS.md: el visor es solo motor; la única entrada para acciones
 * CAD es el CommandBus. La toolbar/línea de comando propias controlan todo.
 * El adapter (cadViewerAdapter) envuelve AcApDocManager y se inyecta en el
 * CommandBus cuando el visor está listo (evento `create`).
 */
import { MlCadViewer } from "@mlightcad/cad-viewer";
import { AcApSettingManager } from "@mlightcad/cad-simple-viewer";
import { commandBus } from "@/cad-core/command-bus";
import { cadViewerAdapter } from "@/cad-adapters/cad-viewer/cad-viewer-adapter-impl";

// Ocultar la UI del visor: usamos nuestra propia toolbar y línea de comando.
// AcApSettingManager es un singleton global leído por MlCadViewer.
const settings = AcApSettingManager.instance;
settings.set("isShowToolbar", false);
settings.set("isShowCommandLine", false);
settings.set("isShowMainMenu", false);
settings.set("isShowCoordinate", false);
settings.set("isShowEntityInfo", false);
settings.set("isShowLanguageSelector", false);
settings.set("isShowStats", false);
settings.set("isShowFileName", false);

function onCreate(): void {
  // El docManager ya está creado por el visor. Atamos el adapter y lo
  // inyectamos en el CommandBus para que los comandos puedan operar.
  cadViewerAdapter.bind();
  commandBus.setAdapter(cadViewerAdapter);
  commandBus.log("Visor CAD inicializado.");
}
</script>

<template>
  <MlCadViewer
    locale="en"
    theme="dark"
    :background="0x1e1e1e"
    base-url="https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/"
    @create="onCreate"
  />
</template>

<style scoped>
/* El visor llena su contenedor; la UI propia va encima en AppLayout. */
:deep(.ml-cad-viewer),
:deep(canvas) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
