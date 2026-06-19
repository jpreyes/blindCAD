<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { selectionManager } from "@/cad-core/selection/selection-manager";

const count = ref(0);
let unsub: (() => void) | null = null;

onMounted(() => {
  unsub = selectionManager.subscribe((e) => {
    count.value = e.ids.size;
  });
});

onBeforeUnmount(() => {
  unsub?.();
});
</script>

<template>
  <div class="props-empty">
    <p>Selection: <strong>{{ count }}</strong> object(s)</p>
    <p class="hint">Propiedades de entidad: paso posterior.</p>
  </div>
</template>

<style scoped>
.props-empty {
  color: var(--text-dim);
  font-size: 12px;
}
.props-empty p {
  margin: 0 0 6px 0;
}
.hint {
  font-size: 11px;
  opacity: 0.6;
}
</style>
