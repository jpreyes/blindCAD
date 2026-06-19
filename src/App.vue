<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import { commandBus } from "@/cad-core/command-bus";
import { registry } from "@/cad-core/command-registry";
import { registerSeedCommands } from "@/cad-core/commands/seed-commands";
import { registerFileCommands } from "@/cad-core/commands/file-commands";
import AppLayout from "@/app/layout/AppLayout.vue";

onMounted(() => {
  registerSeedCommands();
  registerFileCommands();
  commandBus.log(`blindCAD listo. ${registry.list().length} comando(s) registrados.`);
});

onBeforeUnmount(() => {
  commandBus.cancel();
});
</script>

<template>
  <AppLayout />
</template>
