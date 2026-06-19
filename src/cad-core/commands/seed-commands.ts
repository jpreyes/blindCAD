import type { CadCommand, CommandArgs } from "../command-types";
import { registry } from "../command-registry";

/**
 * Sembrador de comandos MVP1 (esqueletos).
 * Cada comando está registrado con su ID, aliases, grupo, icono y tooltip,
 * pero su implementación es un stub que reporta "no implementado".
 * Los pasos siguientes reemplazan estos stubs por máquinas de estado reales.
 *
 * Regla AGENTS.md: la UI solo llama a commandBus.run(ID). Sin lógica duplicada.
 */

interface SeedSpec {
  id: string;
  aliases: string[];
  label: string;
  group: CadCommand["group"];
  icon?: string;
  tooltip?: string;
}

const SEED: SeedSpec[] = [
  // OPEN / LOAD_DXF / LOAD_DWG / SAVE_PROJECT se registran en file-commands.ts (Paso 2).
  // LINE / POLYLINE / RECTANGLE / CIRCLE se registran en draw-commands.ts (Paso 4).
  // SELECT se registra en selection-commands.ts (Paso 3).
  // ERASE / MOVE / COPY / ROTATE / SCALE se registran en modify-commands.ts (Paso 5).
  // UNDO / REDO se registran en undo-redo-commands.ts (Paso 5).

  { id: "ZOOM", aliases: ["Z"], label: "Zoom", group: "view", icon: "zoom", tooltip: "Zoom - Alias: Z" },
  { id: "PAN", aliases: ["P"], label: "Pan", group: "view", icon: "pan", tooltip: "Pan - Alias: P" },
  { id: "REGEN", aliases: ["RE"], label: "Regen", group: "view", icon: "regen", tooltip: "Regen - Alias: RE" },

  { id: "DIMLINEAR", aliases: ["DLI"], label: "Dim Linear", group: "annotate", icon: "dimlinear", tooltip: "Linear Dim - Alias: DLI" },
  { id: "DIMALIGNED", aliases: ["DAL"], label: "Dim Aligned", group: "annotate", icon: "dimaligned", tooltip: "Aligned Dim - Alias: DAL" },
  { id: "DIMANGULAR", aliases: ["DAN"], label: "Dim Angular", group: "annotate", icon: "dimangular", tooltip: "Angular Dim - Alias: DAN" },

  { id: "LAYER", aliases: ["LA"], label: "Layer", group: "layers", icon: "layer", tooltip: "Layer - Alias: LA" },
];

function stubRun(id: string) {
  return (ctx: Parameters<CadCommand["run"]>[0], _args?: CommandArgs): void => {
    ctx.prompter.prompt(`${id}: no implementado en este paso (skeleton).`);
    // TODO(siguiente paso): implementar máquina de estados del comando.
  };
}

export function registerSeedCommands(): void {
  for (const spec of SEED) {
    registry.register({
      id: spec.id,
      aliases: spec.aliases,
      label: spec.label,
      group: spec.group,
      icon: spec.icon,
      tooltip: spec.tooltip,
      run: stubRun(spec.id),
    });
  }
}
