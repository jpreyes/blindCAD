import {
  AcDbLine,
  AcDbPolyline,
  AcGeMatrix3d,
  AcGePoint3d,
  type AcDbCurve,
  type AcDbEntity,
} from "@mlightcad/data-model";
import type { CadCommand, CommandArgs, EntityId } from "../command-types";
import { registry } from "../command-registry";
import { getPoint } from "@/cad-core/input/point-input";
import { pickSelection } from "@/cad-core/selection/selection-utils";

/**
 * Comandos de modificación avanzada (Paso 8 - MVP2).
 * MIRROR/OFFSET/BREAK/JOIN/EXPLODE.
 *
 * TRIM/EXTEND/FILLET/CHAMFER requieren geometría de intersección compleja;
 * se registran como stubs con TODO en geometry-commands.ts.
 *
 * Regla AGENTS.md: la UI solo llama a commandBus.run(ID).
 */

interface Adapter {
  getEntityById(id: EntityId): AcDbEntity | undefined;
  transformEntity(id: EntityId, matrix: AcGeMatrix3d): AcGeMatrix3d;
  eraseEntity(id: EntityId): AcDbEntity | undefined;
  restoreEntity(entity: AcDbEntity): EntityId;
  addNativeEntity(entity: AcDbEntity): EntityId;
}

function toAdapter(ctx: { adapter?: unknown }): Adapter | undefined {
  return ctx.adapter as Adapter | undefined;
}

// --- MIRROR ---
const mirrorCommand: CadCommand = {
  id: "MIRROR",
  aliases: ["MI"],
  label: "Mirror",
  group: "modify",
  icon: "mirror",
  tooltip: "Mirror - Alias: MI",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = toAdapter(ctx);
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const sel = await pickSelection(ctx, false, "Select objects to mirror:");
    if (sel.cancelled || sel.ids.length === 0) return;
    const p1 = await getPoint(ctx, "Specify first point of mirror line:");
    if (p1.cancelled) return ctx.prompter.log("*Cancel*");
    const p2 = await getPoint(ctx, "Specify second point of mirror line:", p1.point);
    if (p2.cancelled) return ctx.prompter.log("*Cancel*");
    // Construir matriz de reflexión sobre la línea p1->p2.
    // Estrategia: rotar la línea al eje X, escalar X por -1, rotar de vuelta.
    const angle = Math.atan2(p2.point.y - p1.point.y, p2.point.x - p1.point.x);
    const m = new AcGeMatrix3d()
      .makeTranslation(-p1.point.x, -p1.point.y, 0)
      .multiply(new AcGeMatrix3d().makeRotationZ(-angle))
      .multiply(new AcGeMatrix3d().makeScale(-1, 1, 1))
      .multiply(new AcGeMatrix3d().makeRotationZ(angle))
      .multiply(new AcGeMatrix3d().makeTranslation(p1.point.x, p1.point.y, 0));
    const tx = ctx.transactions;
    const inverses = new Map<EntityId, AcGeMatrix3d>();
    const doMirror = () => {
      inverses.clear();
      for (const id of sel.ids) {
        const inv = adapter.transformEntity(id, m);
        inverses.set(id, inv);
      }
    };
    const undoMirror = () => {
      for (const [id, inv] of inverses) adapter.transformEntity(id, inv);
    };
    if (tx) tx.run({ name: "MIRROR", do: doMirror, undo: undoMirror });
    else doMirror();
    ctx.prompter.log(`Mirror: ${sel.ids.length} objeto(s).`);
  },
};

// --- OFFSET ---
const offsetCommand: CadCommand = {
  id: "OFFSET",
  aliases: ["O"],
  label: "Offset",
  group: "modify",
  icon: "offset",
  tooltip: "Offset - Alias: O",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = toAdapter(ctx);
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    // Pedir distancia como dos puntos (simplificación).
    const d1 = await getPoint(ctx, "Specify offset distance (first point):");
    if (d1.cancelled) return ctx.prompter.log("*Cancel*");
    const d2 = await getPoint(ctx, "Specify second point:", d1.point);
    if (d2.cancelled) return ctx.prompter.log("*Cancel*");
    const distance = Math.hypot(d2.point.x - d1.point.x, d2.point.y - d1.point.y);
    if (distance <= 0) return ctx.prompter.log("Distancia no válida.");
    const sel = await pickSelection(ctx, true, "Select object to offset:");
    if (sel.cancelled || sel.ids.length === 0) return;
    const entity = adapter.getEntityById(sel.ids[0]);
    if (!entity) return ctx.prompter.log("Entidad no encontrada.");
    // getOffsetCurves está en AcDbCurve; el signo determina el lado.
    // AcDbPolyline lo implementa. Probar ambos signos y usar el que acerque
    // al punto indicado por el usuario (punto lateral).
    const side = await getPoint(ctx, "Specify point on side to offset:");
    if (side.cancelled) return ctx.prompter.log("*Cancel*");
    if (!("getOffsetCurves" in entity) || typeof (entity as AcDbCurve).getOffsetCurves !== "function") {
      ctx.prompter.log("Esta entidad no soporta offset (se espera polyline/line/circle/arc).");
      return;
    }
    const curve = entity as AcDbCurve;
    let offsetCurves: AcDbCurve[] = [];
    try {
      offsetCurves = curve.getOffsetCurves(distance);
    } catch {
      ctx.prompter.log("No se pudo calcular el offset.");
      return;
    }
    if (offsetCurves.length === 0) {
      ctx.prompter.log("Offset no produjo geometría.");
      return;
    }
    const tx = ctx.transactions;
    const newIds: EntityId[] = [];
    const doOffset = () => {
      newIds.length = 0;
      for (const c of offsetCurves) newIds.push(adapter.addNativeEntity(c));
    };
    const undoOffset = () => {
      for (const id of newIds) adapter.eraseEntity(id);
    };
    if (tx) tx.run({ name: "OFFSET", do: doOffset, undo: undoOffset });
    else doOffset();
    void side; // TODO(offset): usar el punto lateral para elegir signo/curva.
    ctx.prompter.log(`Offset: d=${distance.toFixed(2)} (${newIds.length} curva(s)).`);
  },
};

// --- EXPLODE (simplificado: polyline → líneas) ---
const explodeCommand: CadCommand = {
  id: "EXPLODE",
  aliases: ["X"],
  label: "Explode",
  group: "modify",
  icon: "explode",
  tooltip: "Explode - Alias: X",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = toAdapter(ctx);
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const sel = await pickSelection(ctx, true, "Select object to explode:");
    if (sel.cancelled || sel.ids.length === 0) return;
    const entity = adapter.getEntityById(sel.ids[0]);
    if (!entity) return ctx.prompter.log("Entidad no encontrada.");
    if (!(entity instanceof AcDbPolyline)) {
      ctx.prompter.log("EXPLODE: solo soporta polylines en esta versión (TODO).");
      return;
    }
    const poly = entity;
    const n = poly.numberOfVertices;
    if (n < 2) return ctx.prompter.log("Polyline sin geometría.");
    // Construir líneas entre vértices consecutivos.
    const lines: AcDbLine[] = [];
    for (let i = 0; i < n - 1; i++) {
      lines.push(new AcDbLine(poly.getPoint3dAt(i), poly.getPoint3dAt(i + 1)));
    }
    if (poly.closed) {
      lines.push(new AcDbLine(poly.getPoint3dAt(n - 1), poly.getPoint3dAt(0)));
    }
    const tx = ctx.transactions;
    const newIds: EntityId[] = [];
    const doExplode = () => {
      newIds.length = 0;
      for (const l of lines) newIds.push(adapter.addNativeEntity(l));
      adapter.eraseEntity(sel.ids[0]);
    };
    const undoExplode = () => {
      // Restaurar la polyline y borrar las líneas.
      const snap = explodeSnapshots.get(sel.ids[0]);
      if (snap) adapter.restoreEntity(snap);
      for (const id of newIds) adapter.eraseEntity(id);
    };
    // Snapshot de la polyline antes de borrarla (para undo).
    const explodeSnapshots = new Map<EntityId, AcDbEntity>();
    explodeSnapshots.set(sel.ids[0], poly.clone());
    if (tx) tx.run({ name: "EXPLODE", do: doExplode, undo: undoExplode });
    else doExplode();
    ctx.prompter.log(`Explode: ${lines.length} líneas.`);
  },
};

// --- BREAK (simplificado: break line at a point into two lines) ---
const breakCommand: CadCommand = {
  id: "BREAK",
  aliases: ["BR"],
  label: "Break",
  group: "modify",
  icon: "break",
  tooltip: "Break - Alias: BR",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = toAdapter(ctx);
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const sel = await pickSelection(ctx, true, "Select object to break:");
    if (sel.cancelled || sel.ids.length === 0) return;
    const entity = adapter.getEntityById(sel.ids[0]);
    if (!entity) return ctx.prompter.log("Entidad no encontrada.");
    if (!(entity instanceof AcDbLine)) {
      ctx.prompter.log("BREAK: solo soporta líneas en esta versión (TODO).");
      return;
    }
    const line = entity;
    const bp = await getPoint(ctx, "Specify break point:");
    if (bp.cancelled) return ctx.prompter.log("*Cancel*");
    // Dividir la línea en dos: start->bp y bp->end.
    const start = line.startPoint;
    const end = line.endPoint;
    const snap = line.clone();
    const tx = ctx.transactions;
    const newIds: EntityId[] = [];
    const doBreak = () => {
      newIds.length = 0;
      adapter.eraseEntity(sel.ids[0]);
      newIds.push(adapter.addNativeEntity(new AcDbLine(start, new AcGePoint3d(bp.point.x, bp.point.y, 0))));
      newIds.push(adapter.addNativeEntity(new AcDbLine(new AcGePoint3d(bp.point.x, bp.point.y, 0), end)));
    };
    const undoBreak = () => {
      for (const id of newIds) adapter.eraseEntity(id);
      adapter.restoreEntity(snap);
    };
    if (tx) tx.run({ name: "BREAK", do: doBreak, undo: undoBreak });
    else doBreak();
    ctx.prompter.log("Break: línea dividida en 2.");
  },
};

// --- JOIN (simplificado: join two collinear lines into one) ---
const joinCommand: CadCommand = {
  id: "JOIN",
  aliases: ["J"],
  label: "Join",
  group: "modify",
  icon: "join",
  tooltip: "Join - Alias: J",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = toAdapter(ctx);
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const sel = await pickSelection(ctx, false, "Select lines to join:");
    if (sel.cancelled || sel.ids.length < 2) {
      ctx.prompter.log("JOIN: selecciona al menos 2 líneas.");
      return;
    }
    // Filtrar solo líneas.
    const lines: { id: EntityId; line: AcDbLine }[] = [];
    for (const id of sel.ids) {
      const e = adapter.getEntityById(id);
      if (e instanceof AcDbLine) lines.push({ id, line: e });
    }
    if (lines.length < 2) {
      ctx.prompter.log("JOIN: se necesitan al menos 2 líneas (TODO: soportar polylines).");
      return;
    }
    // TODO(join): verificar colinealidad y unir extremos adyacentes.
    // Versión simplificada: unir el primer y último extremo de las líneas
    // seleccionadas (asume que son colineales y contiguas).
    const snaps = lines.map((l) => ({ id: l.id, snap: l.line.clone() }));
    // Tomar extremos: buscar el start y end más alejados entre todas las líneas.
    const pts = lines.flatMap((l) => [l.line.startPoint, l.line.endPoint]);
    let maxDist = 0;
    let iA = 0;
    let iB = 1;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = pts[i].distanceTo(pts[j]);
        if (d > maxDist) {
          maxDist = d;
          iA = i;
          iB = j;
        }
      }
    }
    const newLine = new AcDbLine(pts[iA], pts[iB]);
    const tx = ctx.transactions;
    const doJoin = () => {
      for (const s of snaps) adapter.eraseEntity(s.id);
      joinNewId = adapter.addNativeEntity(newLine);
    };
    const undoJoin = () => {
      if (joinNewId !== undefined) adapter.eraseEntity(joinNewId);
      for (const s of snaps) adapter.restoreEntity(s.snap);
    };
    let joinNewId: EntityId | undefined;
    if (tx) tx.run({ name: "JOIN", do: doJoin, undo: undoJoin });
    else doJoin();
    ctx.prompter.log(`Join: ${lines.length} líneas -> 1.`);
  },
};

export function registerModify2Commands(): void {
  registry.register(mirrorCommand);
  registry.register(offsetCommand);
  registry.register(explodeCommand);
  registry.register(breakCommand);
  registry.register(joinCommand);
}
