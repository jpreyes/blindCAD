import type { CadCommand } from "../command-types";
import { registry } from "../command-registry";
import { STRUCTURAL_LAYERS } from "@/structural";

/**
 * Comando LAYER (Paso 6).
 * Crea las capas estructurales por defecto (plantilla AGENTS.md) y lista
 * las capas existentes. La creación de capas individuales por nombre
 * interactivo se añadirá con el panel Layers.
 *
 * Regla AGENTS.md: la UI solo llama a commandBus.run(ID).
 */

const layerCommand: CadCommand = {
  id: "LAYER",
  aliases: ["LA"],
  label: "Layer",
  group: "layers",
  icon: "layer",
  tooltip: "Layer - Alias: LA",
  run(ctx): void {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    // Crear las capas estructurales por defecto (idempotente).
    let created = 0;
    for (const name of STRUCTURAL_LAYERS) {
      const before = adapter.listLayers().some((l) => l.name === name);
      if (!before) {
        adapter.createLayer(name, defaultColorFor(name));
        created++;
      }
    }
    const all = adapter.listLayers();
    ctx.prompter.log(`Capas: ${created} creada(s), ${all.length} total.`);
    for (const l of all) {
      ctx.prompter.log(`  ${l.isOff ? "[off]" : "     "} ${l.name}`);
    }
  },
};

/** Color RGB por defecto según el prefijo de la capa estructural. */
function defaultColorFor(name: string): number {
  if (name.startsWith("S-AXIS")) return 0xffd700; // dorado
  if (name.startsWith("S-REBAR")) return 0xff6a00; // naranjo
  if (name.startsWith("S-STEEL")) return 0x4aa3ff; // azul
  if (name.startsWith("S-BOLTS")) return 0xff4c4c; // rojo
  if (name.startsWith("S-WELDS")) return 0xff4c4c;
  if (name.startsWith("S-DIMS")) return 0x80c8ff;
  if (name.startsWith("S-TEXT")) return 0xd4d4d4;
  if (name.startsWith("S-HATCH")) return 0x9a9a9a;
  if (name.startsWith("S-HIDDEN")) return 0x6a6a6a;
  if (name.startsWith("S-CENTER")) return 0x80ff80;
  return 0xd4d4d4;
}

export function registerLayerCommands(): void {
  registry.register(layerCommand);
}
