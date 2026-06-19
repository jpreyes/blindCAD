import { AcDbCircle, AcDbLine, AcDbPolyline, AcGePoint2d, AcGePoint3d, type AcDbEntity } from "@mlightcad/data-model";
import type { CadCommand, CommandArgs, EntityId } from "../command-types";
import { registry } from "../command-registry";
import { getPoint } from "@/cad-core/input/point-input";

/**
 * Comandos de dibujo (Paso 4) como máquinas de estado.
 * Cada uno pide puntos vía editor.getPoint (con OSNAP activo del visor),
 * construye una entidad nativa AcDbEntity y la añade via adapter.addNativeEntity.
 * Cada entidad se registra como transacción (undo = erase) para que el undo
 * cubra también la creación de geometría.
 *
 * Regla AGENTS.md: la UI solo llama a commandBus.run(ID). Sin lógica duplicada.
 */

function p3(p: { x: number; y: number; z?: number }): AcGePoint3d {
  return new AcGePoint3d(p.x, p.y, p.z ?? 0);
}

/** Añade una entidad y registra una transacción (undo = borrar la entidad). */
function addWithUndo(ctx: { adapter?: { addNativeEntity(e: AcDbEntity): EntityId; eraseEntity(id: EntityId): unknown }; transactions?: { run(tx: { name: string; do(): void; undo(): void }): void } }, entity: AcDbEntity): EntityId | undefined {
  const adapter = ctx.adapter;
  if (!adapter) return undefined;
  let id: EntityId | undefined;
  const doAdd = () => {
    id = adapter.addNativeEntity(entity);
  };
  const undoAdd = () => {
    if (id !== undefined) adapter.eraseEntity(id);
  };
  if (ctx.transactions) {
    ctx.transactions.run({ name: "DRAW", do: doAdd, undo: undoAdd });
  } else {
    doAdd();
  }
  return id;
}

// --- LINE ---
const lineCommand: CadCommand = {
  id: "LINE",
  aliases: ["L"],
  label: "Line",
  group: "draw",
  icon: "line",
  tooltip: "Line - Alias: L",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) {
      ctx.prompter.log("Visor no disponible.");
      return;
    }
    const first = await getPoint(ctx, "Specify first point:");
    if (first.cancelled) {
      ctx.prompter.log("*Cancel*");
      return;
    }
    // Bucle: sigue pidiendo "next point" hasta ESC o Enter (cancelado).
    let prev = first.point;
    while (true) {
      const next = await getPoint(ctx, "Specify next point:", prev);
      if (next.cancelled) {
        ctx.prompter.log("*Cancel*");
        return;
      }
      const line = new AcDbLine(p3(prev), p3(next.point));
      addWithUndo(ctx, line);
      ctx.prompter.log(`Line: (${prev.x},${prev.y}) -> (${next.point.x},${next.point.y})`);
      prev = next.point;
    }
  },
};

// --- CIRCLE ---
const circleCommand: CadCommand = {
  id: "CIRCLE",
  aliases: ["C"],
  label: "Circle",
  group: "draw",
  icon: "circle",
  tooltip: "Circle - Alias: C",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) {
      ctx.prompter.log("Visor no disponible.");
      return;
    }
    const center = await getPoint(ctx, "Specify center point for circle:");
    if (center.cancelled) {
      ctx.prompter.log("*Cancel*");
      return;
    }
    // Pedir un punto de radio (distancia al centro). OSNAP activo.
    const radiusPt = await getPoint(ctx, "Specify radius of circle:", center.point);
    if (radiusPt.cancelled) {
      ctx.prompter.log("*Cancel*");
      return;
    }
    const dx = radiusPt.point.x - center.point.x;
    const dy = radiusPt.point.y - center.point.y;
    const radius = Math.hypot(dx, dy);
    if (radius <= 0) {
      ctx.prompter.log("Radio no válido.");
      return;
    }
    const circle = new AcDbCircle(p3(center.point), radius);
    addWithUndo(ctx, circle);
    ctx.prompter.log(`Circle: center=(${center.point.x},${center.point.y}) r=${radius.toFixed(2)}`);
  },
};

// --- RECTANGLE ---
const rectangleCommand: CadCommand = {
  id: "RECTANGLE",
  aliases: ["REC"],
  label: "Rectangle",
  group: "draw",
  icon: "rect",
  tooltip: "Rectangle - Alias: REC",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) {
      ctx.prompter.log("Visor no disponible.");
      return;
    }
    const p1 = await getPoint(ctx, "Specify first corner point:");
    if (p1.cancelled) {
      ctx.prompter.log("*Cancel*");
      return;
    }
    const p2 = await getPoint(ctx, "Specify other corner point:", p1.point);
    if (p2.cancelled) {
      ctx.prompter.log("*Cancel*");
      return;
    }
    const x1 = Math.min(p1.point.x, p2.point.x);
    const y1 = Math.min(p1.point.y, p2.point.y);
    const x2 = Math.max(p1.point.x, p2.point.x);
    const y2 = Math.max(p1.point.y, p2.point.y);
    // Rectángulo como polilínea cerrada de 4 vértices.
    const poly = new AcDbPolyline();
    poly.addVertexAt(0, new AcGePoint2d(x1, y1));
    poly.addVertexAt(1, new AcGePoint2d(x2, y1));
    poly.addVertexAt(2, new AcGePoint2d(x2, y2));
    poly.addVertexAt(3, new AcGePoint2d(x1, y2));
    poly.closed = true;
    addWithUndo(ctx, poly);
    ctx.prompter.log(`Rectangle: (${x1},${y1}) - (${x2},${y2})`);
  },
};

// --- POLYLINE ---
const polylineCommand: CadCommand = {
  id: "POLYLINE",
  aliases: ["PL"],
  label: "Polyline",
  group: "draw",
  icon: "polyline",
  tooltip: "Polyline - Alias: PL",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) {
      ctx.prompter.log("Visor no disponible.");
      return;
    }
    const first = await getPoint(ctx, "Specify start point:");
    if (first.cancelled) {
      ctx.prompter.log("*Cancel*");
      return;
    }
    const poly = new AcDbPolyline();
    poly.addVertexAt(0, new AcGePoint2d(first.point.x, first.point.y));
    let index = 1;
    let prev = first.point;
    while (true) {
      const next = await getPoint(ctx, "Specify next point:", prev);
      if (next.cancelled) {
        // Al cancelar, se inserta la polilínea con los vértices acumulados.
        if (poly.numberOfVertices >= 2) {
          addWithUndo(ctx, poly);
          ctx.prompter.log(`Polyline: ${poly.numberOfVertices} vertices.`);
        } else {
          ctx.prompter.log("*Cancel*");
        }
        return;
      }
      poly.addVertexAt(index, new AcGePoint2d(next.point.x, next.point.y));
      index++;
      prev = next.point;
    }
  },
};

export function registerDrawCommands(): void {
  registry.register(lineCommand);
  registry.register(circleCommand);
  registry.register(rectangleCommand);
  registry.register(polylineCommand);
}
