import { AcDbArc, AcDbLine, AcGePoint3d, type AcDbEntity } from "@mlightcad/data-model";
import type { CadCommand, EntityId } from "../command-types";
import { registry } from "../command-registry";
import { getPoint } from "@/cad-core/input/point-input";
import { pickSelection } from "@/cad-core/selection/selection-utils";
import {
  lineLineIntersect,
  segmentIntersect,
  dist,
  filletArc,
  type Pt2,
} from "@/cad-core/geometry/intersect";

/**
 * Comandos de geometría (Paso 8/11 - MVP2/post-MVP).
 * TRIM/EXTEND/FILLET/CHAMFER.
 *
 * Versión mínima: soporta AcDbLine (segmentos rectos). Para curvas complejas
 * (arcos/círculos/polylines con bulge) se deja TODO. Se calculan intersecciones
 * manualmente con las utilidades de geometry/intersect.ts.
 *
 * Regla AGENTS.md: "implementa la solución mínima razonable y deja TODOs".
 */

interface Adapter {
  getEntityById(id: EntityId): AcDbEntity | undefined;
  eraseEntity(id: EntityId): AcDbEntity | undefined;
  addNativeEntity(entity: AcDbEntity): EntityId;
  restoreEntity(entity: AcDbEntity): EntityId;
}

function toAdapter(ctx: { adapter?: unknown }): Adapter | undefined {
  return ctx.adapter as Adapter | undefined;
}

function p2(p: { x: number; y: number }): Pt2 {
  return { x: p.x, y: p.y };
}

function requireLine(ctx: { prompter: { log(s: string): void } }, entity: AcDbEntity): AcDbLine | null {
  if (!(entity instanceof AcDbLine)) {
    ctx.prompter.log("Esta versión solo soporta líneas (TODO: curvas).");
    return null;
  }
  return entity;
}

// --- TRIM ---
const trimCommand: CadCommand = {
  id: "TRIM",
  aliases: ["TR"],
  label: "Trim",
  group: "modify",
  icon: "trim",
  tooltip: "Trim - Alias: TR",
  async run(ctx): Promise<void> {
    const adapter = toAdapter(ctx);
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    // Seleccionar cutting edges (líneas de corte).
    const edges = await pickSelection(ctx, false, "Select cutting edges:");
    if (edges.cancelled || edges.ids.length === 0) return;
    const edgeLines: { id: EntityId; line: AcDbLine }[] = [];
    for (const id of edges.ids) {
      const e = adapter.getEntityById(id);
      const line = e ? requireLine(ctx, e) : null;
      if (line) edgeLines.push({ id, line });
    }
    if (edgeLines.length === 0) return ctx.prompter.log("No hay cutting edges válidas.");
    // Seleccionar objeto a recortar.
    const target = await pickSelection(ctx, true, "Select object to trim:");
    if (target.cancelled || target.ids.length === 0) return;
    const tEntity = adapter.getEntityById(target.ids[0]);
    const tLine = tEntity ? requireLine(ctx, tEntity) : null;
    if (!tLine) return;
    // Punto para decidir qué extremo recortar.
    const pick = await getPoint(ctx, "Specify point on side to trim:");
    if (pick.cancelled) return ctx.prompter.log("*Cancel*");
    const s = p2(tLine.startPoint);
    const e = p2(tLine.endPoint);
    const pickPt = p2(pick.point);
    // Encontrar la intersección más cercana al punto de pick entre la línea y las edges.
    let bestInt: Pt2 | null = null;
    let bestDist = Infinity;
    for (const edge of edgeLines) {
      const es = p2(edge.line.startPoint);
      const ee = p2(edge.line.endPoint);
      const inter = segmentIntersect(s, e, es, ee);
      if (inter) {
        const d = dist(inter, pickPt);
        if (d < bestDist) {
          bestDist = d;
          bestInt = inter;
        }
      }
    }
    if (!bestInt) return ctx.prompter.log("No se encontró intersección de corte.");
    // Recortar: reemplazar la línea por el segmento desde bestInt hasta el extremo
    // más lejano al punto de pick.
    const dStart = dist(s, pickPt);
    const dEnd = dist(e, pickPt);
    const farPt = dStart > dEnd ? s : e;
    const newLine = new AcDbLine(
      new AcGePoint3d(bestInt.x, bestInt.y, 0),
      new AcGePoint3d(farPt.x, farPt.y, 0),
    );
    const snap = tLine.clone();
    const tx = ctx.transactions;
    const doTrim = () => {
      adapter.eraseEntity(target.ids[0]);
      trimNewId = adapter.addNativeEntity(newLine);
    };
    const undoTrim = () => {
      if (trimNewId !== undefined) adapter.eraseEntity(trimNewId);
      adapter.restoreEntity(snap);
    };
    let trimNewId: EntityId | undefined;
    if (tx) tx.run({ name: "TRIM", do: doTrim, undo: undoTrim });
    else doTrim();
    ctx.prompter.log("Trim: línea recortada.");
  },
};

// --- EXTEND ---
const extendCommand: CadCommand = {
  id: "EXTEND",
  aliases: ["EX"],
  label: "Extend",
  group: "modify",
  icon: "extend",
  tooltip: "Extend - Alias: EX",
  async run(ctx): Promise<void> {
    const adapter = toAdapter(ctx);
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const edges = await pickSelection(ctx, false, "Select boundary edges:");
    if (edges.cancelled || edges.ids.length === 0) return;
    const edgeLines: { line: AcDbLine }[] = [];
    for (const id of edges.ids) {
      const e = adapter.getEntityById(id);
      const line = e ? requireLine(ctx, e) : null;
      if (line) edgeLines.push({ line });
    }
    if (edgeLines.length === 0) return ctx.prompter.log("No hay boundary edges válidas.");
    const target = await pickSelection(ctx, true, "Select object to extend:");
    if (target.cancelled || target.ids.length === 0) return;
    const tEntity = adapter.getEntityById(target.ids[0]);
    const tLine = tEntity ? requireLine(ctx, tEntity) : null;
    if (!tLine) return;
    const pick = await getPoint(ctx, "Specify point on side to extend:");
    if (pick.cancelled) return ctx.prompter.log("*Cancel*");
    const s = p2(tLine.startPoint);
    const e = p2(tLine.endPoint);
    const pickPt = p2(pick.point);
    // El extremo a extender es el más cercano al punto de pick.
    const dStart = dist(s, pickPt);
    const dEnd = dist(e, pickPt);
    const nearPt = dStart < dEnd ? s : e;
    const farPt = dStart < dEnd ? e : s;
    // Encontrar la intersección de la línea (extendida infinitamente) con la edge más cercana.
    let bestInt: Pt2 | null = null;
    let bestDist = Infinity;
    for (const edge of edgeLines) {
      const es = p2(edge.line.startPoint);
      const ee = p2(edge.line.endPoint);
      const inter = lineLineIntersect(s, e, es, ee);
      if (inter) {
        const d = dist(inter, nearPt);
        if (d < bestDist) {
          bestDist = d;
          bestInt = inter;
        }
      }
    }
    if (!bestInt) return ctx.prompter.log("No se encontró intersección de extensión.");
    const newLine = new AcDbLine(
      new AcGePoint3d(farPt.x, farPt.y, 0),
      new AcGePoint3d(bestInt.x, bestInt.y, 0),
    );
    const snap = tLine.clone();
    const tx = ctx.transactions;
    const doExtend = () => {
      adapter.eraseEntity(target.ids[0]);
      extendNewId = adapter.addNativeEntity(newLine);
    };
    const undoExtend = () => {
      if (extendNewId !== undefined) adapter.eraseEntity(extendNewId);
      adapter.restoreEntity(snap);
    };
    let extendNewId: EntityId | undefined;
    if (tx) tx.run({ name: "EXTEND", do: doExtend, undo: undoExtend });
    else doExtend();
    ctx.prompter.log("Extend: línea extendida.");
  },
};

// --- FILLET ---
const filletCommand: CadCommand = {
  id: "FILLET",
  aliases: ["F"],
  label: "Fillet",
  group: "modify",
  icon: "fillet",
  tooltip: "Fillet - Alias: F",
  async run(ctx): Promise<void> {
    const adapter = toAdapter(ctx);
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const radius = await (async () => {
      const editor = ctx.adapter?.editor;
      if (!editor) return 10;
      const { AcEdPromptDistanceOptions, AcEdPromptStatus } = await import("@mlightcad/cad-simple-viewer");
      const opts = new AcEdPromptDistanceOptions("Specify fillet radius:");
      ctx.prompter.prompt("Specify fillet radius:");
      const res = await editor.getDistance(opts);
      ctx.prompter.clearPrompt();
      if (res.status !== AcEdPromptStatus.OK) return 10;
      return res.value ?? 10;
    })();
    const sel = await pickSelection(ctx, false, "Select first line:");
    if (sel.cancelled || sel.ids.length === 0) return;
    const e1 = adapter.getEntityById(sel.ids[0]);
    const l1 = e1 ? requireLine(ctx, e1) : null;
    if (!l1) return;
    const sel2 = await pickSelection(ctx, true, "Select second line:");
    if (sel2.cancelled || sel2.ids.length === 0) return;
    const e2 = adapter.getEntityById(sel2.ids[0]);
    const l2 = e2 ? requireLine(ctx, e2) : null;
    if (!l2) return;
    const arc = filletArc(
      p2(l1.startPoint),
      p2(l1.endPoint),
      p2(l2.startPoint),
      p2(l2.endPoint),
      radius,
    );
    if (!arc) return ctx.prompter.log("No se pudo calcular el fillet.");
    // Crear el arco y recortar las líneas hasta los puntos de tangencia.
    // Arc desde p1 hasta p2 con centro en center y radio r.
    const startAngle = Math.atan2(arc.p1.y - arc.center.y, arc.p1.x - arc.center.x);
    const endAngle = Math.atan2(arc.p2.y - arc.center.y, arc.p2.x - arc.center.x);
    let sweep = endAngle - startAngle;
    if (sweep < 0) sweep += 2 * Math.PI;
    const arcEntity = new AcDbArc(
      new AcGePoint3d(arc.center.x, arc.center.y, 0),
      arc.r,
      startAngle,
      startAngle + sweep,
    );
    // Recortar l1 desde el extremo más cercano a p1 hasta p1.
    const d1s = dist(p2(l1.startPoint), arc.p1);
    const d1e = dist(p2(l1.endPoint), arc.p1);
    const newL1 = new AcDbLine(
      d1s < d1e ? new AcGePoint3d(l1.startPoint.x, l1.startPoint.y, 0) : new AcGePoint3d(l1.endPoint.x, l1.endPoint.y, 0),
      new AcGePoint3d(arc.p1.x, arc.p1.y, 0),
    );
    const d2s = dist(p2(l2.startPoint), arc.p2);
    const d2e = dist(p2(l2.endPoint), arc.p2);
    const newL2 = new AcDbLine(
      d2s < d2e ? new AcGePoint3d(l2.startPoint.x, l2.startPoint.y, 0) : new AcGePoint3d(l2.endPoint.x, l2.endPoint.y, 0),
      new AcGePoint3d(arc.p2.x, arc.p2.y, 0),
    );
    const snap1 = l1.clone();
    const snap2 = l2.clone();
    const tx = ctx.transactions;
    const doFillet = () => {
      adapter.eraseEntity(sel.ids[0]);
      adapter.eraseEntity(sel2.ids[0]);
      filletIds = [adapter.addNativeEntity(newL1), adapter.addNativeEntity(arcEntity), adapter.addNativeEntity(newL2)];
    };
    const undoFillet = () => {
      for (const id of filletIds) adapter.eraseEntity(id);
      adapter.restoreEntity(snap1);
      adapter.restoreEntity(snap2);
    };
    let filletIds: EntityId[] = [];
    if (tx) tx.run({ name: "FILLET", do: doFillet, undo: undoFillet });
    else doFillet();
    ctx.prompter.log(`Fillet: r=${radius}`);
  },
};

// --- CHAMFER ---
const chamferCommand: CadCommand = {
  id: "CHAMFER",
  aliases: ["CHA"],
  label: "Chamfer",
  group: "modify",
  icon: "chamfer",
  tooltip: "Chamfer - Alias: CHA",
  async run(ctx): Promise<void> {
    const adapter = toAdapter(ctx);
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const dist1 = await (async () => {
      const editor = ctx.adapter?.editor;
      if (!editor) return 10;
      const { AcEdPromptDistanceOptions, AcEdPromptStatus } = await import("@mlightcad/cad-simple-viewer");
      const opts = new AcEdPromptDistanceOptions("Specify first chamfer distance:");
      ctx.prompter.prompt("Specify first chamfer distance:");
      const res = await editor.getDistance(opts);
      ctx.prompter.clearPrompt();
      if (res.status !== AcEdPromptStatus.OK) return 10;
      return res.value ?? 10;
    })();
    const dist2 = dist1; // distancias iguales por defecto (45°)
    const sel = await pickSelection(ctx, false, "Select first line:");
    if (sel.cancelled || sel.ids.length === 0) return;
    const e1 = adapter.getEntityById(sel.ids[0]);
    const l1 = e1 ? requireLine(ctx, e1) : null;
    if (!l1) return;
    const sel2 = await pickSelection(ctx, true, "Select second line:");
    if (sel2.cancelled || sel2.ids.length === 0) return;
    const e2 = adapter.getEntityById(sel2.ids[0]);
    const l2 = e2 ? requireLine(ctx, e2) : null;
    if (!l2) return;
    const inter = lineLineIntersect(p2(l1.startPoint), p2(l1.endPoint), p2(l2.startPoint), p2(l2.endPoint));
    if (!inter) return ctx.prompter.log("Las líneas no se intersecan.");
    // Puntos de chamfer: a distancia dist1/dist2 desde la intersección a lo largo de cada línea.
    const dir1 = norm(sub(p2(l1.endPoint), p2(l1.startPoint)));
    const dir2 = norm(sub(p2(l2.endPoint), p2(l2.startPoint)));
    // Elegir la dirección hacia el extremo más cercano de cada línea.
    const p1 = { x: inter.x + dir1.x * dist1, y: inter.y + dir1.y * dist1 };
    const p2c = { x: inter.x + dir2.x * dist2, y: inter.y + dir2.y * dist2 };
    // Línea de chamfer entre p1 y p2c.
    const chamferLine = new AcDbLine(new AcGePoint3d(p1.x, p1.y, 0), new AcGePoint3d(p2c.x, p2c.y, 0));
    // Recortar las líneas originales hasta los puntos de chamfer.
    const newL1 = trimLineTo(l1, p1);
    const newL2 = trimLineTo(l2, p2c);
    const snap1 = l1.clone();
    const snap2 = l2.clone();
    const tx = ctx.transactions;
    const doChamfer = () => {
      adapter.eraseEntity(sel.ids[0]);
      adapter.eraseEntity(sel2.ids[0]);
      chamferIds = [adapter.addNativeEntity(newL1), adapter.addNativeEntity(chamferLine), adapter.addNativeEntity(newL2)];
    };
    const undoChamfer = () => {
      for (const id of chamferIds) adapter.eraseEntity(id);
      adapter.restoreEntity(snap1);
      adapter.restoreEntity(snap2);
    };
    let chamferIds: EntityId[] = [];
    if (tx) tx.run({ name: "CHAMFER", do: doChamfer, undo: undoChamfer });
    else doChamfer();
    ctx.prompter.log(`Chamfer: d1=${dist1} d2=${dist2}`);
  },
};

function trimLineTo(line: AcDbLine, pt: Pt2): AcDbLine {
  const s = p2(line.startPoint);
  const e = p2(line.endPoint);
  const keep = dist(s, pt) > dist(e, pt) ? s : e;
  return new AcDbLine(new AcGePoint3d(keep.x, keep.y, 0), new AcGePoint3d(pt.x, pt.y, 0));
}

function norm(v: Pt2): Pt2 {
  const l = Math.hypot(v.x, v.y);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
}

function sub(a: Pt2, b: Pt2): Pt2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function registerGeometryCommands(): void {
  registry.register(trimCommand);
  registry.register(extendCommand);
  registry.register(filletCommand);
  registry.register(chamferCommand);
}
