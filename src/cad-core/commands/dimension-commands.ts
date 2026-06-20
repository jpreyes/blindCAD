import {
  AcDb3PointAngularDimension,
  AcDbAlignedDimension,
  AcDbRotatedDimension,
  AcGePoint3d,
} from "@mlightcad/data-model";
import type { CadCommand, CommandArgs, EntityId } from "../command-types";
import type { AcDbDimension } from "@mlightcad/data-model";
import { registry } from "../command-registry";
import { getPoint } from "@/cad-core/input/point-input";

/**
 * Comandos de acotación (Paso 7) — completa el MVP1.
 * Construyen entidades de dimensión nativas de @mlightcad/data-model y las
 * añaden via adapter.addDimension (que maneja el dim block interno).
 *
 * - DIMLINEAR: dimensión lineal rotada (horizontal/vertical auto-detectado)
 * - DIMALIGNED: dimensión alineada (paralela a la línea entre 2 puntos)
 * - DIMANGULAR: dimensión angular (3 puntos: vértice + 2 extremos)
 *
 * Regla AGENTS.md: la UI solo llama a commandBus.run(ID).
 */

function p3(p: { x: number; y: number; z?: number }): AcGePoint3d {
  return new AcGePoint3d(p.x, p.y, p.z ?? 0);
}

/** Añade una dimensión con undo (undo = erase). */
function addDimWithUndo(
  ctx: {
    adapter?: { addDimension(dim: AcDbDimension): EntityId; eraseEntity(id: EntityId): unknown };
    transactions?: { run(tx: { name: string; do(): void; undo(): void }): void };
  },
  dim: AcDbDimension,
): EntityId | undefined {
  const adapter = ctx.adapter;
  if (!adapter) return undefined;
  let id: EntityId | undefined;
  const doAdd = () => {
    id = adapter.addDimension(dim);
  };
  const undoAdd = () => {
    if (id !== undefined) adapter.eraseEntity(id);
  };
  if (ctx.transactions) {
    ctx.transactions.run({ name: "DIMENSION", do: doAdd, undo: undoAdd });
  } else {
    doAdd();
  }
  return id;
}

// --- DIMLINEAR ---
const dimLinearCommand: CadCommand = {
  id: "DIMLINEAR",
  aliases: ["DLI"],
  label: "Dim Linear",
  group: "annotate",
  icon: "dimlinear",
  tooltip: "Linear Dimension - Alias: DLI",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const p1 = await getPoint(ctx, "Specify first extension line origin:");
    if (p1.cancelled) return ctx.prompter.log("*Cancel*");
    const p2 = await getPoint(ctx, "Specify second extension line origin:", p1.point);
    if (p2.cancelled) return ctx.prompter.log("*Cancel*");
    const dimLine = await getPoint(ctx, "Specify dimension line location:", {
      x: (p1.point.x + p2.point.x) / 2,
      y: (p1.point.y + p2.point.y) / 2,
    });
    if (dimLine.cancelled) return ctx.prompter.log("*Cancel*");
    // Auto-detectar horizontal vs vertical según la posición de la línea de cota.
    const dx = p2.point.x - p1.point.x;
    const dy = p2.point.y - p1.point.y;
    const midX = (p1.point.x + p2.point.x) / 2;
    const midY = (p1.point.y + p2.point.y) / 2;
    // Si la línea de cota está más desplazada en Y que en X → horizontal (rot=0).
    // Si está más desplazada en X que en Y → vertical (rot=PI/2).
    const offsetY = Math.abs(dimLine.point.y - midY);
    const offsetX = Math.abs(dimLine.point.x - midX);
    const rotation = offsetY >= offsetX ? 0 : Math.PI / 2;
    const dim = new AcDbRotatedDimension(p3(p1.point), p3(p2.point), p3(dimLine.point));
    dim.rotation = rotation;
    // Texto de cota: la distancia medida (X para horizontal, Y para vertical).
    const measured = rotation === 0 ? Math.abs(dx) : Math.abs(dy);
    dim.dimensionText = measured.toFixed(2);
    addDimWithUndo(ctx, dim);
    ctx.prompter.log(`DimLinear: ${measured.toFixed(2)} (${rotation === 0 ? "H" : "V"})`);
  },
};

// --- DIMALIGNED ---
const dimAlignedCommand: CadCommand = {
  id: "DIMALIGNED",
  aliases: ["DAL"],
  label: "Dim Aligned",
  group: "annotate",
  icon: "dimaligned",
  tooltip: "Aligned Dimension - Alias: DAL",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const p1 = await getPoint(ctx, "Specify first extension line origin:");
    if (p1.cancelled) return ctx.prompter.log("*Cancel*");
    const p2 = await getPoint(ctx, "Specify second extension line origin:", p1.point);
    if (p2.cancelled) return ctx.prompter.log("*Cancel*");
    const dimLine = await getPoint(ctx, "Specify dimension line location:", {
      x: (p1.point.x + p2.point.x) / 2,
      y: (p1.point.y + p2.point.y) / 2,
    });
    if (dimLine.cancelled) return ctx.prompter.log("*Cancel*");
    const dist = Math.hypot(p2.point.x - p1.point.x, p2.point.y - p1.point.y);
    const dim = new AcDbAlignedDimension(p3(p1.point), p3(p2.point), p3(dimLine.point));
    dim.dimensionText = dist.toFixed(2);
    addDimWithUndo(ctx, dim);
    ctx.prompter.log(`DimAligned: ${dist.toFixed(2)}`);
  },
};

// --- DIMANGULAR ---
const dimAngularCommand: CadCommand = {
  id: "DIMANGULAR",
  aliases: ["DAN"],
  label: "Dim Angular",
  group: "annotate",
  icon: "dimangular",
  tooltip: "Angular Dimension - Alias: DAN",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const vertex = await getPoint(ctx, "Specify angle vertex:");
    if (vertex.cancelled) return ctx.prompter.log("*Cancel*");
    const p1 = await getPoint(ctx, "Specify first angle endpoint:", vertex.point);
    if (p1.cancelled) return ctx.prompter.log("*Cancel*");
    const p2 = await getPoint(ctx, "Specify second angle endpoint:", vertex.point);
    if (p2.cancelled) return ctx.prompter.log("*Cancel*");
    const arcPt = await getPoint(ctx, "Specify dimension arc location:", {
      x: (vertex.point.x + p1.point.x + p2.point.x) / 3,
      y: (vertex.point.y + p1.point.y + p2.point.y) / 3,
    });
    if (arcPt.cancelled) return ctx.prompter.log("*Cancel*");
    // Calcular el ángulo entre los dos brazos.
    const a1 = Math.atan2(p1.point.y - vertex.point.y, p1.point.x - vertex.point.x);
    const a2 = Math.atan2(p2.point.y - vertex.point.y, p2.point.x - vertex.point.x);
    let angle = Math.abs(a2 - a1);
    if (angle > Math.PI) angle = 2 * Math.PI - angle;
    const degs = (angle * 180) / Math.PI;
    const dim = new AcDb3PointAngularDimension(
      p3(vertex.point),
      p3(p1.point),
      p3(p2.point),
      p3(arcPt.point),
    );
    dim.dimensionText = `${degs.toFixed(1)}°`;
    addDimWithUndo(ctx, dim);
    ctx.prompter.log(`DimAngular: ${degs.toFixed(1)}°`);
  },
};

export function registerDimensionCommands(): void {
  registry.register(dimLinearCommand);
  registry.register(dimAlignedCommand);
  registry.register(dimAngularCommand);
}
