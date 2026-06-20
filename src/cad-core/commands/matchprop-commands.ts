import type { AcDbEntity } from "@mlightcad/data-model";
import type { CadCommand, EntityId } from "../command-types";
import { registry } from "../command-registry";
import { pickSelection } from "@/cad-core/selection/selection-utils";

/**
 * Comando MATCHPROP (post-MVP).
 * Copia propiedades (color, capa, linetype) de una entidad origen a otras.
 *
 * Regla AGENTS.md: el panel no modifica entidades directamente; usa comandos.
 */

interface Adapter {
  getEntityById(id: EntityId): AcDbEntity | undefined;
}

const matchpropCommand: CadCommand = {
  id: "MATCHPROP",
  aliases: ["MA"],
  label: "Match Properties",
  group: "layers",
  icon: "matchprop",
  tooltip: "Match properties - Alias: MA",
  async run(ctx): Promise<void> {
    const adapter = ctx.adapter as Adapter | undefined;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    // Seleccionar entidad origen.
    const src = await pickSelection(ctx, true, "Select source object:");
    if (src.cancelled || src.ids.length === 0) return;
    const srcEntity = adapter.getEntityById(src.ids[0]);
    if (!srcEntity) return ctx.prompter.log("Entidad origen no encontrada.");
    // Seleccionar entidades destino.
    const dst = await pickSelection(ctx, false, "Select destination objects:");
    if (dst.cancelled || dst.ids.length === 0) return;
    const tx = ctx.transactions;
    // Capturar snapshots para undo.
    const snaps = new Map<EntityId, { layer: string; colorIndex: number }>();
    const srcLayer = srcEntity.layer;
    const srcColor = srcEntity.color;
    const doMatch = () => {
      snaps.clear();
      for (const id of dst.ids) {
        const e = adapter.getEntityById(id);
        if (!e) continue;
        snaps.set(id, { layer: e.layer, colorIndex: e.color.colorIndex ?? 0 });
        e.layer = srcLayer;
        // AcCmColor no se puede asignar directamente por valor; copiar método.
        try {
          e.color = srcColor;
        } catch {
          // Algunas entidades pueden rechazar la asignación.
        }
      }
    };
    const undoMatch = () => {
      for (const [id, snap] of snaps) {
        const e = adapter.getEntityById(id);
        if (!e) continue;
        e.layer = snap.layer;
      }
    };
    if (tx) tx.run({ name: "MATCHPROP", do: doMatch, undo: undoMatch });
    else doMatch();
    ctx.prompter.log(`MatchProp: ${dst.ids.length} objeto(s) actualizados.`);
  },
};

export function registerMatchpropCommand(): void {
  registry.register(matchpropCommand);
}
