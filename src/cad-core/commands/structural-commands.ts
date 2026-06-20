import {
  AcDbCircle,
  AcDbLine,
  AcDbMText,
  AcDbPolyline,
  AcGePoint2d,
  AcGePoint3d,
  type AcDbEntity,
} from "@mlightcad/data-model";
import type { CadCommand, CommandArgs, EntityId, Point } from "../command-types";
import { registry } from "../command-registry";
import { getPoint } from "@/cad-core/input/point-input";

/**
 * Herramientas estructurales (Paso 10 - MVP4).
 * Dibujan y anotan rápido (no calculan conexiones completas, per AGENTS.md).
 * Cada comando crea geometría compuesta (polylines/líneas/círculos/texto)
 * en las capas estructurales (S-REBAR, S-STEEL, S-BOLTS, S-WELDS, ...).
 *
 * Regla AGENTS.md: la UI solo llama a commandBus.run(ID).
 */

function p3(p: Point): AcGePoint3d {
  return new AcGePoint3d(p.x, p.y, p.z ?? 0);
}

function addWithUndo(
  ctx: {
    adapter?: { addNativeEntity(e: AcDbEntity): EntityId; eraseEntity(id: EntityId): unknown };
    transactions?: { run(tx: { name: string; do(): void; undo(): void }): void };
  },
  entities: AcDbEntity[],
): EntityId[] {
  const adapter = ctx.adapter;
  if (!adapter) return [];
  const ids: EntityId[] = [];
  const doAdd = () => {
    ids.length = 0;
    for (const e of entities) ids.push(adapter.addNativeEntity(e));
  };
  const undoAdd = () => {
    for (const id of ids) adapter.eraseEntity(id);
  };
  if (ctx.transactions) {
    ctx.transactions.run({ name: "STRUCTURAL", do: doAdd, undo: undoAdd });
  } else {
    doAdd();
  }
  return ids;
}

async function promptString(
  ctx: Parameters<CadCommand["run"]>[0],
  message: string,
  def = "",
): Promise<string> {
  const editor = ctx.adapter?.editor;
  if (!editor) return def;
  const { AcEdPromptStringOptions, AcEdPromptStatus } = await import("@mlightcad/cad-simple-viewer");
  const opts = new AcEdPromptStringOptions(message);
  ctx.prompter.prompt(message);
  const res = await editor.getString(opts);
  ctx.prompter.clearPrompt();
  if (res.status !== AcEdPromptStatus.OK) return def;
  return res.stringResult ?? def;
}

async function promptNumber(ctx: Parameters<CadCommand["run"]>[0], message: string, def: number): Promise<number> {
  const s = await promptString(ctx, message, String(def));
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}

// =====================================================================
// REBAR — barra de refuerzo (polilínea + ganchos + etiqueta)
// =====================================================================
const rebarCommand: CadCommand = {
  id: "REBAR",
  aliases: ["RBAR"],
  label: "Rebar",
  group: "structural",
  icon: "rebar",
  tooltip: "Draw rebar - Alias: RBAR",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const diameter = await promptNumber(ctx, "Bar diameter (mm):", 16);
    const p1 = await getPoint(ctx, "Specify start point:");
    if (p1.cancelled) return ctx.prompter.log("*Cancel*");
    const p2 = await getPoint(ctx, "Specify end point:", p1.point);
    if (p2.cancelled) return ctx.prompter.log("*Cancel*");
    // Barra como polilínea (ganchos estándar 90°/135° simplificados).
    const hookLen = diameter * 6;
    const dx = p2.point.x - p1.point.x;
    const dy = p2.point.y - p1.point.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const poly = new AcDbPolyline();
    // Gancho inicial.
    poly.addVertexAt(0, new AcGePoint2d(p1.point.x + nx * hookLen, p1.point.y + ny * hookLen));
    poly.addVertexAt(1, new AcGePoint2d(p1.point.x, p1.point.y));
    poly.addVertexAt(2, new AcGePoint2d(p2.point.x, p2.point.y));
    // Gancho final (135° simplificado).
    poly.addVertexAt(3, new AcGePoint2d(p2.point.x + nx * hookLen, p2.point.y + ny * hookLen));
    poly.layer = "S-REBAR";
    // Etiqueta.
    const label = new AcDbMText();
    label.contents = `Ø${diameter}`;
    label.location = new AcGePoint3d((p1.point.x + p2.point.x) / 2, (p1.point.y + p2.point.y) / 2 + diameter, 0);
    label.height = diameter * 0.8;
    label.layer = "S-REBAR-TEXT";
    addWithUndo(ctx, [poly, label]);
    ctx.prompter.log(`Rebar: Ø${diameter} L=${len.toFixed(0)}`);
  },
};

// =====================================================================
// STIRRUP — estribo rectangular con ganchos
// =====================================================================
const stirrupCommand: CadCommand = {
  id: "STIRRUP",
  aliases: ["RSTIR"],
  label: "Stirrup",
  group: "structural",
  icon: "stirrup",
  tooltip: "Draw stirrup - Alias: RSTIR",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const diameter = await promptNumber(ctx, "Stirrup diameter (mm):", 8);
    const corner = await getPoint(ctx, "Specify corner point:");
    if (corner.cancelled) return ctx.prompter.log("*Cancel*");
    const w = await promptNumber(ctx, "Width (mm):", 200);
    const h = await promptNumber(ctx, "Height (mm):", 400);
    const hookLen = diameter * 6;
    const x = corner.point.x;
    const y = corner.point.y;
    const poly = new AcDbPolyline();
    // Rectángulo + gancho 135° en una esquina (simplificado).
    poly.addVertexAt(0, new AcGePoint2d(x, y));
    poly.addVertexAt(1, new AcGePoint2d(x + w, y));
    poly.addVertexAt(2, new AcGePoint2d(x + w, y + h));
    poly.addVertexAt(3, new AcGePoint2d(x, y + h));
    poly.addVertexAt(4, new AcGePoint2d(x, y + hookLen));
    poly.addVertexAt(5, new AcGePoint2d(x - hookLen * 0.7, y - hookLen * 0.7));
    poly.closed = false;
    poly.layer = "S-REBAR";
    addWithUndo(ctx, [poly]);
    ctx.prompter.log(`Stirrup: Ø${diameter} ${w}x${h}`);
  },
};

// =====================================================================
// REBARSET — distribuye barras a lo largo de una línea
// =====================================================================
const rebarSetCommand: CadCommand = {
  id: "REBARSET",
  aliases: ["RSET"],
  label: "Rebar Set",
  group: "structural",
  icon: "rebarset",
  tooltip: "Distribute rebar - Alias: RSET",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const diameter = await promptNumber(ctx, "Bar diameter (mm):", 16);
    const spacing = await promptNumber(ctx, "Spacing (mm):", 150);
    const p1 = await getPoint(ctx, "Specify distribution start point:");
    if (p1.cancelled) return ctx.prompter.log("*Cancel*");
    const p2 = await getPoint(ctx, "Specify distribution end point:", p1.point);
    if (p2.cancelled) return ctx.prompter.log("*Cancel*");
    const dx = p2.point.x - p1.point.x;
    const dy = p2.point.y - p1.point.y;
    const len = Math.hypot(dx, dy);
    const count = Math.floor(len / spacing) + 1;
    const ux = dx / len;
    const uy = dy / len;
    // Línea de distribución.
    const distLine = new AcDbLine(p3(p1.point), p3(p2.point));
    distLine.layer = "S-REBAR";
    // Marcas de barra (cortas perpendiculares).
    const entities: AcDbEntity[] = [distLine];
    const markLen = diameter * 4;
    const nx = -uy;
    const ny = ux;
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const cx = p1.point.x + dx * t;
      const cy = p1.point.y + dy * t;
      const mark = new AcDbPolyline();
      mark.addVertexAt(0, new AcGePoint2d(cx - nx * markLen, cy - ny * markLen));
      mark.addVertexAt(1, new AcGePoint2d(cx + nx * markLen, cy + ny * markLen));
      mark.layer = "S-REBAR";
      entities.push(mark);
    }
    // Etiqueta.
    const label = new AcDbMText();
    label.contents = `${count}Ø${diameter} @${spacing}`;
    label.location = new AcGePoint3d((p1.point.x + p2.point.x) / 2, (p1.point.y + p2.point.y) / 2, 0);
    label.height = diameter * 0.8;
    label.layer = "S-REBAR-TEXT";
    entities.push(label);
    addWithUndo(ctx, entities);
    ctx.prompter.log(`RebarSet: ${count}Ø${diameter} @${spacing}`);
  },
};

// =====================================================================
// REBARCALLOUT — líder + etiqueta apuntando a una barra
// =====================================================================
const rebarCalloutCommand: CadCommand = {
  id: "REBARCALLOUT",
  aliases: ["RCALL"],
  label: "Rebar Callout",
  group: "structural",
  icon: "rebarcallout",
  tooltip: "Rebar callout - Alias: RCALL",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const label = await promptString(ctx, "Callout text (e.g. 4Ø16 L=2000):", "4Ø16");
    const target = await getPoint(ctx, "Specify point on rebar:");
    if (target.cancelled) return ctx.prompter.log("*Cancel*");
    const leader = await getPoint(ctx, "Specify leader end point:", target.point);
    if (leader.cancelled) return ctx.prompter.log("*Cancel*");
    const line = new AcDbLine(p3(target.point), p3(leader.point));
    line.layer = "S-REBAR-TEXT";
    const txt = new AcDbMText();
    txt.contents = label;
    txt.location = p3(leader.point);
    txt.height = 12;
    txt.layer = "S-REBAR-TEXT";
    addWithUndo(ctx, [line, txt]);
    ctx.prompter.log(`Callout: "${label}"`);
  },
};

// =====================================================================
// REBARSCHEDULE — tabla de despiece (grid de texto + líneas)
// =====================================================================
const rebarScheduleCommand: CadCommand = {
  id: "REBARSCHEDULE",
  aliases: ["RTABLE"],
  label: "Rebar Schedule",
  group: "structural",
  icon: "rebarschedule",
  tooltip: "Rebar schedule table - Alias: RTABLE",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const origin = await getPoint(ctx, "Specify table origin:");
    if (origin.cancelled) return ctx.prompter.log("*Cancel*");
    // Tabla simple: 5 columnas (Mark, Ø, Length, Qty, Total) x 4 filas + header.
    const cols = ["Mark", "Ø", "Length", "Qty", "Total"];
    const colW = 40;
    const rowH = 20;
    const rows = 4;
    const entities: AcDbEntity[] = [];
    const ox = origin.point.x;
    const oy = origin.point.y;
    const totalW = colW * cols.length;
    const totalH = rowH * (rows + 1);
    // Líneas horizontales.
    for (let r = 0; r <= rows + 1; r++) {
      const line = new AcDbLine(new AcGePoint3d(ox, oy - r * rowH, 0), new AcGePoint3d(ox + totalW, oy - r * rowH, 0));
      line.layer = "S-TEXT";
      entities.push(line);
    }
    // Líneas verticales.
    for (let c = 0; c <= cols.length; c++) {
      const line = new AcDbLine(new AcGePoint3d(ox + c * colW, oy, 0), new AcGePoint3d(ox + c * colW, oy - totalH, 0));
      line.layer = "S-TEXT";
      entities.push(line);
    }
    // Headers.
    for (let c = 0; c < cols.length; c++) {
      const txt = new AcDbMText();
      txt.contents = cols[c];
      txt.location = new AcGePoint3d(ox + c * colW + colW / 2, oy - rowH / 2, 0);
      txt.height = 8;
      txt.layer = "S-TEXT";
      entities.push(txt);
    }
    // Título.
    const title = new AcDbMText();
    title.contents = "REBAR SCHEDULE";
    title.location = new AcGePoint3d(ox + totalW / 2, oy + 15, 0);
    title.height = 10;
    title.layer = "S-TITLEBLOCK";
    entities.push(title);
    addWithUndo(ctx, entities);
    ctx.prompter.log(`Rebar schedule table: ${cols.length} cols x ${rows} rows.`);
  },
};

// =====================================================================
// STEELPROFILE — dibuja perfil estructural (IPE/IPN/HEA/HEB/UPN/L/TUBE)
// =====================================================================
const steelProfileCommand: CadCommand = {
  id: "STEELPROFILE",
  aliases: ["SPROF"],
  label: "Steel Profile",
  group: "structural",
  icon: "steelprofile",
  tooltip: "Draw steel profile cross-section - Alias: SPROF",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const profileType = await promptString(ctx, "Profile type (IPE/IPN/HEA/HEB/UPN/L/TUBE_RECT/TUBE_CIRC):", "IPE");
    const insertion = await getPoint(ctx, "Specify insertion point:");
    if (insertion.cancelled) return ctx.prompter.log("*Cancel*");
    // Dimensiones simplificadas (mm) — secciones comunes.
    const profiles: Record<string, { w: number; h: number; tf: number; tw: number } | { r: number } | { w: number; h: number }> = {
      IPE: { w: 100, h: 200, tf: 8.5, tw: 5.6 },
      IPN: { w: 100, h: 200, tf: 10, tw: 6.5 },
      HEA: { w: 200, h: 190, tf: 10, tw: 6.5 },
      HEB: { w: 200, h: 200, tf: 15, tw: 9 },
      UPN: { w: 80, h: 200, tf: 11, tw: 6 },
      L: { w: 50, h: 50 },
      TUBE_RECT: { w: 100, h: 50 },
      TUBE_CIRC: { r: 50 },
    };
    const p = profiles[profileType.toUpperCase()];
    if (!p) {
      ctx.prompter.log(`Perfil "${profileType}" no reconocido. Disponibles: ${Object.keys(profiles).join(", ")}`);
      return;
    }
    const x = insertion.point.x;
    const y = insertion.point.y;
    const entities: AcDbEntity[] = [];
    if ("r" in p) {
      // TUBE_CIRC — círculo.
      const c = new AcDbCircle(new AcGePoint3d(x, y, 0), p.r);
      c.layer = "S-STEEL";
      entities.push(c);
    } else if (!("tf" in p)) {
      // L o TUBE_RECT — rectángulo simple.
      const poly = new AcDbPolyline();
      poly.addVertexAt(0, new AcGePoint2d(x - p.w / 2, y - p.h / 2));
      poly.addVertexAt(1, new AcGePoint2d(x + p.w / 2, y - p.h / 2));
      poly.addVertexAt(2, new AcGePoint2d(x + p.w / 2, y + p.h / 2));
      poly.addVertexAt(3, new AcGePoint2d(x - p.w / 2, y + p.h / 2));
      poly.closed = true;
      poly.layer = "S-STEEL";
      entities.push(poly);
    } else {
      // Perfil I/H/U — sección en I simplificada.
      const { w, h, tf, tw } = p;
      const hw = w / 2;
      const hh = h / 2;
      // Perfil I como polilínea cerrada (sección transversal).
      const poly = new AcDbPolyline();
      poly.addVertexAt(0, new AcGePoint2d(x - hw, y - hh));
      poly.addVertexAt(1, new AcGePoint2d(x + hw, y - hh));
      poly.addVertexAt(2, new AcGePoint2d(x + hw, y - hh + tf));
      poly.addVertexAt(3, new AcGePoint2d(x + tw / 2, y - hh + tf));
      poly.addVertexAt(4, new AcGePoint2d(x + tw / 2, y + hh - tf));
      poly.addVertexAt(5, new AcGePoint2d(x + hw, y + hh - tf));
      poly.addVertexAt(6, new AcGePoint2d(x + hw, y + hh));
      poly.addVertexAt(7, new AcGePoint2d(x - hw, y + hh));
      poly.addVertexAt(8, new AcGePoint2d(x - hw, y + hh - tf));
      poly.addVertexAt(9, new AcGePoint2d(x - tw / 2, y + hh - tf));
      poly.addVertexAt(10, new AcGePoint2d(x - tw / 2, y - hh + tf));
      poly.addVertexAt(11, new AcGePoint2d(x - hw, y - hh + tf));
      poly.closed = true;
      poly.layer = "S-STEEL";
      entities.push(poly);
    }
    // Etiqueta del perfil.
    const label = new AcDbMText();
    label.contents = profileType.toUpperCase();
    label.location = new AcGePoint3d(x, y, 0);
    label.height = 10;
    label.layer = "S-STEEL-TEXT";
    entities.push(label);
    addWithUndo(ctx, entities);
    ctx.prompter.log(`Steel profile: ${profileType}`);
  },
};

// =====================================================================
// PLATE — placa rectangular
// =====================================================================
const plateCommand: CadCommand = {
  id: "PLATE",
  aliases: ["PLATE"],
  label: "Plate",
  group: "structural",
  icon: "plate",
  tooltip: "Draw steel plate - Alias: PLATE",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const p1 = await getPoint(ctx, "Specify first corner:");
    if (p1.cancelled) return ctx.prompter.log("*Cancel*");
    const p2 = await getPoint(ctx, "Specify opposite corner:", p1.point);
    if (p2.cancelled) return ctx.prompter.log("*Cancel*");
    const x1 = Math.min(p1.point.x, p2.point.x);
    const y1 = Math.min(p1.point.y, p2.point.y);
    const x2 = Math.max(p1.point.x, p2.point.x);
    const y2 = Math.max(p1.point.y, p2.point.y);
    const poly = new AcDbPolyline();
    poly.addVertexAt(0, new AcGePoint2d(x1, y1));
    poly.addVertexAt(1, new AcGePoint2d(x2, y1));
    poly.addVertexAt(2, new AcGePoint2d(x2, y2));
    poly.addVertexAt(3, new AcGePoint2d(x1, y2));
    poly.closed = true;
    poly.layer = "S-STEEL";
    const w = x2 - x1;
    const h = y2 - y1;
    const label = new AcDbMText();
    label.contents = `PL ${w.toFixed(0)}x${h.toFixed(0)}`;
    label.location = new AcGePoint3d((x1 + x2) / 2, (y1 + y2) / 2, 0);
    label.height = 10;
    label.layer = "S-STEEL-TEXT";
    addWithUndo(ctx, [poly, label]);
    ctx.prompter.log(`Plate: ${w.toFixed(0)}x${h.toFixed(0)}`);
  },
};

// =====================================================================
// BOLTGROUP — grupo de pernos (círculos en patrón lineal)
// =====================================================================
const boltGroupCommand: CadCommand = {
  id: "BOLTGROUP",
  aliases: ["BOLT"],
  label: "Bolt Group",
  group: "structural",
  icon: "boltgroup",
  tooltip: "Draw bolt group - Alias: BOLT",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const diameter = await promptNumber(ctx, "Bolt diameter (mm):", 16);
    const count = Math.max(2, Math.round(await promptNumber(ctx, "Number of bolts:", 4)));
    const spacing = await promptNumber(ctx, "Spacing (mm):", 80);
    const start = await getPoint(ctx, "Specify start point:");
    if (start.cancelled) return ctx.prompter.log("*Cancel*");
    const end = await getPoint(ctx, "Specify direction end point:", start.point);
    if (end.cancelled) return ctx.prompter.log("*Cancel*");
    const dx = end.point.x - start.point.x;
    const dy = end.point.y - start.point.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const r = diameter / 2;
    const entities: AcDbEntity[] = [];
    for (let i = 0; i < count; i++) {
      const cx = start.point.x + ux * spacing * i;
      const cy = start.point.y + uy * spacing * i;
      const c = new AcDbCircle(new AcGePoint3d(cx, cy, 0), r);
      c.layer = "S-BOLTS";
      entities.push(c);
    }
    addWithUndo(ctx, entities);
    ctx.prompter.log(`Bolt group: ${count}x Ø${diameter} @${spacing}`);
  },
};

// =====================================================================
// WELD — símbolo de soldadura (línea de referencia + flecha + marca)
// =====================================================================
const weldCommand: CadCommand = {
  id: "WELD",
  aliases: ["WELD"],
  label: "Weld",
  group: "structural",
  icon: "weld",
  tooltip: "Draw weld symbol - Alias: WELD",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const weldType = await promptString(ctx, "Weld type (FILLET/BEVEL):", "FILLET");
    const target = await getPoint(ctx, "Specify weld point (arrow tip):");
    if (target.cancelled) return ctx.prompter.log("*Cancel*");
    const ref = await getPoint(ctx, "Specify reference line end:", target.point);
    if (ref.cancelled) return ctx.prompter.log("*Cancel*");
    const entities: AcDbEntity[] = [];
    // Flecha (línea inclinada).
    const arrow = new AcDbLine(p3(target.point), p3(ref.point));
    arrow.layer = "S-WELDS";
    entities.push(arrow);
    // Línea de referencia horizontal.
    const refLen = 40;
    const refLine = new AcDbLine(p3(ref.point), new AcGePoint3d(ref.point.x + refLen, ref.point.y, 0));
    refLine.layer = "S-WELDS";
    entities.push(refLine);
    // Símbolo de soldadura (triángulo para FILLET, V para BEVEL).
    if (weldType.toUpperCase() === "FILLET") {
      const tri = new AcDbPolyline();
      tri.addVertexAt(0, new AcGePoint2d(ref.point.x + 5, ref.point.y));
      tri.addVertexAt(1, new AcGePoint2d(ref.point.x + 15, ref.point.y));
      tri.addVertexAt(2, new AcGePoint2d(ref.point.x + 5, ref.point.y - 10));
      tri.closed = true;
      tri.layer = "S-WELDS";
      entities.push(tri);
    } else {
      const v = new AcDbLine(new AcGePoint3d(ref.point.x + 5, ref.point.y, 0), new AcGePoint3d(ref.point.x + 12, ref.point.y - 10, 0));
      v.layer = "S-WELDS";
      entities.push(v);
    }
    // Etiqueta.
    const txt = new AcDbMText();
    txt.contents = weldType.toUpperCase();
    txt.location = new AcGePoint3d(ref.point.x + refLen + 5, ref.point.y, 0);
    txt.height = 8;
    txt.layer = "S-WELDS";
    entities.push(txt);
    addWithUndo(ctx, entities);
    ctx.prompter.log(`Weld: ${weldType}`);
  },
};

// =====================================================================
// SECTIONTAG — símbolo de corte (línea + flechas + burbuja con etiqueta)
// =====================================================================
const sectionTagCommand: CadCommand = {
  id: "SECTIONTAG",
  aliases: ["SECT"],
  label: "Section Tag",
  group: "structural",
  icon: "sectiontag",
  tooltip: "Draw section cut symbol - Alias: SECT",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const label = await promptString(ctx, "Section label (e.g. A):", "A");
    const p1 = await getPoint(ctx, "Specify section line start:");
    if (p1.cancelled) return ctx.prompter.log("*Cancel*");
    const p2 = await getPoint(ctx, "Specify section line end:", p1.point);
    if (p2.cancelled) return ctx.prompter.log("*Cancel*");
    const entities: AcDbEntity[] = [];
    // Línea de corte (con gaps en los extremos para las burbujas).
    const gap = 15;
    const dx = p2.point.x - p1.point.x;
    const dy = p2.point.y - p1.point.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const line = new AcDbLine(
      new AcGePoint3d(p1.point.x + ux * gap, p1.point.y + uy * gap, 0),
      new AcGePoint3d(p2.point.x - ux * gap, p2.point.y - uy * gap, 0),
    );
    line.layer = "S-DETAIL";
    entities.push(line);
    // Burbujas (círculos) en cada extremo con la etiqueta.
    for (const pt of [p1.point, p2.point]) {
      const bubble = new AcDbCircle(new AcGePoint3d(pt.x, pt.y, 0), gap);
      bubble.layer = "S-DETAIL";
      entities.push(bubble);
      const txt = new AcDbMText();
      txt.contents = label;
      txt.location = new AcGePoint3d(pt.x, pt.y, 0);
      txt.height = 10;
      txt.layer = "S-DETAIL";
      entities.push(txt);
    }
    addWithUndo(ctx, entities);
    ctx.prompter.log(`Section tag: ${label}`);
  },
};

// =====================================================================
// DETAILCALLOUT — llamada de detalle (burbuja + líder)
// =====================================================================
const detailCalloutCommand: CadCommand = {
  id: "DETAILCALLOUT",
  aliases: [],
  label: "Detail Callout",
  group: "structural",
  icon: "detailcallout",
  tooltip: "Draw detail callout bubble",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const sheetRef = await promptString(ctx, "Sheet reference (e.g. 3):", "3");
    const detailNum = await promptString(ctx, "Detail number (e.g. 1):", "1");
    const target = await getPoint(ctx, "Specify detail point:");
    if (target.cancelled) return ctx.prompter.log("*Cancel*");
    const bubble = await getPoint(ctx, "Specify bubble center:", target.point);
    if (bubble.cancelled) return ctx.prompter.log("*Cancel*");
    const entities: AcDbEntity[] = [];
    // Líder.
    const leader = new AcDbLine(p3(target.point), p3(bubble.point));
    leader.layer = "S-DETAIL";
    entities.push(leader);
    // Burbuja circular.
    const r = 15;
    const circ = new AcDbCircle(p3(bubble.point), r);
    circ.layer = "S-DETAIL";
    entities.push(circ);
    // Línea divisoria vertical dentro de la burbuja.
    const div = new AcDbLine(
      new AcGePoint3d(bubble.point.x, bubble.point.y - r, 0),
      new AcGePoint3d(bubble.point.x, bubble.point.y + r, 0),
    );
    div.layer = "S-DETAIL";
    entities.push(div);
    // Número de detalle (izquierda) y referencia de lámina (derecha).
    const numText = new AcDbMText();
    numText.contents = detailNum;
    numText.location = new AcGePoint3d(bubble.point.x - r / 2, bubble.point.y, 0);
    numText.height = 10;
    numText.layer = "S-DETAIL";
    entities.push(numText);
    const sheetText = new AcDbMText();
    sheetText.contents = sheetRef;
    sheetText.location = new AcGePoint3d(bubble.point.x + r / 2, bubble.point.y, 0);
    sheetText.height = 10;
    sheetText.layer = "S-DETAIL";
    entities.push(sheetText);
    addWithUndo(ctx, entities);
    ctx.prompter.log(`Detail callout: ${detailNum}/${sheetRef}`);
  },
};

export function registerStructuralCommands(): void {
  registry.register(rebarCommand);
  registry.register(stirrupCommand);
  registry.register(rebarSetCommand);
  registry.register(rebarCalloutCommand);
  registry.register(rebarScheduleCommand);
  registry.register(steelProfileCommand);
  registry.register(plateCommand);
  registry.register(boltGroupCommand);
  registry.register(weldCommand);
  registry.register(sectionTagCommand);
  registry.register(detailCalloutCommand);
}
