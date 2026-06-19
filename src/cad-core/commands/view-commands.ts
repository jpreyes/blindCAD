import type { CadCommand, CommandArgs } from "../command-types";
import { registry } from "../command-registry";
import { getPoint } from "@/cad-core/input/point-input";

/**
 * Comandos de vista (Paso 6).
 * ZOOM: extents o ventana. PAN: traslación por dos puntos. REGEN: regenera.
 * Delegan en el CadViewerAdapter, que envuelve AcApDocManager/curView.
 *
 * Regla AGENTS.md: la UI solo llama a commandBus.run(ID).
 */

// --- REGEN ---
const regenCommand: CadCommand = {
  id: "REGEN",
  aliases: ["RE"],
  label: "Regen",
  group: "view",
  icon: "regen",
  tooltip: "Regen - Alias: RE",
  run(ctx): void {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    adapter.regen();
    ctx.prompter.log("Regenerating drawing.");
  },
};

// --- ZOOM ---
const zoomCommand: CadCommand = {
  id: "ZOOM",
  aliases: ["Z"],
  label: "Zoom",
  group: "view",
  icon: "zoom",
  tooltip: "Zoom - Alias: Z",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    ctx.prompter.prompt("Specify first corner or [Extents]:");
    // Simplificación: pedir dos esquinas para zoom ventana.
    // Si el usuario cancela en el primer punto, hacer zoom extents.
    const p1 = await getPoint(ctx, "Specify first corner (ESC for extents):");
    if (p1.cancelled) {
      adapter.zoomExtents();
      ctx.prompter.clearPrompt();
      ctx.prompter.log("Zoom extents.");
      return;
    }
    const p2 = await getPoint(ctx, "Specify opposite corner:", p1.point);
    if (p2.cancelled) {
      ctx.prompter.log("*Cancel*");
      return;
    }
    adapter.zoomWindow(p1.point, p2.point);
    ctx.prompter.log("Zoom window.");
  },
};

// --- PAN ---
const panCommand: CadCommand = {
  id: "PAN",
  aliases: ["P"],
  label: "Pan",
  group: "view",
  icon: "pan",
  tooltip: "Pan - Alias: P",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const from = await getPoint(ctx, "Specify first point (pan from):");
    if (from.cancelled) return ctx.prompter.log("*Cancel*");
    const to = await getPoint(ctx, "Specify second point (pan to):", from.point);
    if (to.cancelled) return ctx.prompter.log("*Cancel*");
    const dx = to.point.x - from.point.x;
    const dy = to.point.y - from.point.y;
    adapter.pan(dx, dy);
    ctx.prompter.log(`Pan: dx=${dx.toFixed(2)} dy=${dy.toFixed(2)}`);
  },
};

export function registerViewCommands(): void {
  registry.register(zoomCommand);
  registry.register(panCommand);
  registry.register(regenCommand);
}
