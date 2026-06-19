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

  { id: "LINE", aliases: ["L"], label: "Line", group: "draw", icon: "line", tooltip: "Line - Alias: L" },
  { id: "POLYLINE", aliases: ["PL"], label: "Polyline", group: "draw", icon: "polyline", tooltip: "Polyline - Alias: PL" },
  { id: "RECTANGLE", aliases: ["REC"], label: "Rectangle", group: "draw", icon: "rect", tooltip: "Rectangle - Alias: REC" },
  { id: "CIRCLE", aliases: ["C"], label: "Circle", group: "draw", icon: "circle", tooltip: "Circle - Alias: C" },

  { id: "ERASE", aliases: ["E"], label: "Erase", group: "modify", icon: "erase", tooltip: "Erase - Alias: E" },
  // SELECT se registra en selection-commands.ts (Paso 3).
  { id: "MOVE", aliases: ["M"], label: "Move", group: "modify", icon: "move", tooltip: "Move - Alias: M" },
  { id: "COPY", aliases: ["CO", "CP"], label: "Copy", group: "modify", icon: "copy", tooltip: "Copy - Alias: CO/CP" },
  { id: "ROTATE", aliases: ["RO"], label: "Rotate", group: "modify", icon: "rotate", tooltip: "Rotate - Alias: RO" },
  { id: "SCALE", aliases: ["SC"], label: "Scale", group: "modify", icon: "scale", tooltip: "Scale - Alias: SC" },

  { id: "ZOOM", aliases: ["Z"], label: "Zoom", group: "view", icon: "zoom", tooltip: "Zoom - Alias: Z" },
  { id: "PAN", aliases: ["P"], label: "Pan", group: "view", icon: "pan", tooltip: "Pan - Alias: P" },
  { id: "REGEN", aliases: ["RE"], label: "Regen", group: "view", icon: "regen", tooltip: "Regen - Alias: RE" },

  { id: "DIMLINEAR", aliases: ["DLI"], label: "Dim Linear", group: "annotate", icon: "dimlinear", tooltip: "Linear Dim - Alias: DLI" },
  { id: "DIMALIGNED", aliases: ["DAL"], label: "Dim Aligned", group: "annotate", icon: "dimaligned", tooltip: "Aligned Dim - Alias: DAL" },
  { id: "DIMANGULAR", aliases: ["DAN"], label: "Dim Angular", group: "annotate", icon: "dimangular", tooltip: "Angular Dim - Alias: DAN" },

  { id: "LAYER", aliases: ["LA"], label: "Layer", group: "layers", icon: "layer", tooltip: "Layer - Alias: LA" },
  { id: "UNDO", aliases: [], label: "Undo", group: "modify", icon: "undo", tooltip: "Undo" },
  { id: "REDO", aliases: [], label: "Redo", group: "modify", icon: "redo", tooltip: "Redo" },
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
