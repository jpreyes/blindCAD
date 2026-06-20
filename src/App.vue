<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import { commandBus } from "@/cad-core/command-bus";
import { registry } from "@/cad-core/command-registry";
import { registerSeedCommands } from "@/cad-core/commands/seed-commands";
import { registerFileCommands } from "@/cad-core/commands/file-commands";
import { registerSelectionCommands } from "@/cad-core/commands/selection-commands";
import { registerOsnapCommands } from "@/cad-core/commands/osnap-commands";
import { registerDrawCommands } from "@/cad-core/commands/draw-commands";
import { registerModifyCommands } from "@/cad-core/commands/modify-commands";
import { registerUndoRedoCommands } from "@/cad-core/commands/undo-redo-commands";
import { registerViewCommands } from "@/cad-core/commands/view-commands";
import { registerLayerCommands } from "@/cad-core/commands/layer-commands";
import { registerDimensionCommands } from "@/cad-core/commands/dimension-commands";
import { registerAnnotationCommands } from "@/cad-core/commands/annotation-commands";
import { registerModify2Commands } from "@/cad-core/commands/modify2-commands";
import { registerGeometryCommands } from "@/cad-core/commands/geometry-commands";
import AppLayout from "@/app/layout/AppLayout.vue";

onMounted(() => {
  registerSeedCommands();
  registerFileCommands();
  registerSelectionCommands();
  registerOsnapCommands();
  registerDrawCommands();
  registerModifyCommands();
  registerUndoRedoCommands();
  registerViewCommands();
  registerLayerCommands();
  registerDimensionCommands();
  registerAnnotationCommands();
  registerModify2Commands();
  registerGeometryCommands();
  commandBus.log(`blindCAD listo. ${registry.list().length} comando(s) registrados.`);
});

onBeforeUnmount(() => {
  commandBus.cancel();
});
</script>

<template>
  <AppLayout />
</template>
