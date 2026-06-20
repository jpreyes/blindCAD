import {
  AcDbHatch,
  AcDbMText,
  AcDbPolyline,
  AcDbText,
  AcDbWipeout,
  AcGePoint3d,
  AcGePolyline2d,
  AcDbHatchPatternType,
  HATCH_PATTERN_SOLID,
  type AcDbEntity,
} from "@mlightcad/data-model";
import type { CadCommand, CommandArgs, EntityId } from "../command-types";
import { registry } from "../command-registry";
import { getPoint } from "@/cad-core/input/point-input";
import { pickSelection } from "@/cad-core/selection/selection-utils";

/**
 * Comandos de anotación (Paso 8 - MVP2).
 * TEXT/MTEXT: texto simple y multilinea. HATCH: sombreados. WIPEOUT: máscara.
 *
 * Regla AGENTS.md: la UI solo llama a commandBus.run(ID).
 */

function p3(p: { x: number; y: number; z?: number }): AcGePoint3d {
  return new AcGePoint3d(p.x, p.y, p.z ?? 0);
}

function addWithUndo(
  ctx: {
    adapter?: { addNativeEntity(e: AcDbEntity): EntityId; eraseEntity(id: EntityId): unknown };
    transactions?: { run(tx: { name: string; do(): void; undo(): void }): void };
  },
  entity: AcDbEntity,
): EntityId | undefined {
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
    ctx.transactions.run({ name: "ANNOTATE", do: doAdd, undo: undoAdd });
  } else {
    doAdd();
  }
  return id;
}

// --- TEXT ---
const textCommand: CadCommand = {
  id: "TEXT",
  aliases: ["T"],
  label: "Text",
  group: "annotate",
  icon: "text",
  tooltip: "Text - Alias: T",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const pos = await getPoint(ctx, "Specify start point of text:");
    if (pos.cancelled) return ctx.prompter.log("*Cancel*");
    // Pedir altura como distancia (simplificación: usar getPoint para altura).
    const heightPt = await getPoint(ctx, "Specify height:", pos.point);
    if (heightPt.cancelled) return ctx.prompter.log("*Cancel*");
    const height = Math.hypot(
      heightPt.point.x - pos.point.x,
      heightPt.point.y - pos.point.y,
    );
    if (height <= 0) return ctx.prompter.log("Altura no válida.");
    // Texto: se pide por la línea de comando (string). Por ahora usa un texto
    // por defecto; la edición interactiva de string se integrará con el input
    // manager del visor en un paso posterior.
    const text = (await promptString(ctx, "Enter text:")) ?? "Text";
    const entity = new AcDbText();
    entity.textString = text;
    entity.position = p3(pos.point);
    entity.height = height;
    addWithUndo(ctx, entity);
    ctx.prompter.log(`Text: "${text}" h=${height.toFixed(2)}`);
  },
};

// --- MTEXT ---
const mtextCommand: CadCommand = {
  id: "MTEXT",
  aliases: ["MT"],
  label: "MText",
  group: "annotate",
  icon: "mtext",
  tooltip: "MText - Alias: MT",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const pos = await getPoint(ctx, "Specify first corner:");
    if (pos.cancelled) return ctx.prompter.log("*Cancel*");
    const heightPt = await getPoint(ctx, "Specify text height:", pos.point);
    if (heightPt.cancelled) return ctx.prompter.log("*Cancel*");
    const height = Math.hypot(
      heightPt.point.x - pos.point.x,
      heightPt.point.y - pos.point.y,
    );
    if (height <= 0) return ctx.prompter.log("Altura no válida.");
    const text = (await promptString(ctx, "Enter text:")) ?? "MText";
    const entity = new AcDbMText();
    entity.contents = text;
    entity.location = p3(pos.point);
    entity.height = height;
    addWithUndo(ctx, entity);
    ctx.prompter.log(`MText: "${text}" h=${height.toFixed(2)}`);
  },
};

// --- HATCH_SOLID ---
const hatchSolidCommand: CadCommand = {
  id: "HATCH_SOLID",
  aliases: [],
  label: "Hatch Solid",
  group: "annotate",
  icon: "hatch-solid",
  tooltip: "Solid hatch fill",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    await runHatch(ctx, HATCH_PATTERN_SOLID, 1, 0);
  },
};

// --- HATCH_ANSI31 ---
const hatchAnsi31Command: CadCommand = {
  id: "HATCH_ANSI31",
  aliases: ["H"],
  label: "Hatch ANSI31",
  group: "annotate",
  icon: "hatch",
  tooltip: "ANSI31 hatch pattern - Alias: H",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    await runHatch(ctx, "ANSI31", 1, 0);
  },
};

/**
 * Flujo común de hatch: selecciona una polilínea cerrada como boundary,
 * construye el loop y añade el hatch.
 */
async function runHatch(
  ctx: Parameters<CadCommand["run"]>[0],
  patternName: string,
  scale: number,
  angleDeg: number,
): Promise<void> {
  const adapter = ctx.adapter;
  if (!adapter) return ctx.prompter.log("Visor no disponible.");
  // TODO(hatch): soportar detección automática de contornos. Por ahora,
  // el flujo inicial (AGENTS.md) pide seleccionar una polilínea cerrada.
  const sel = await pickSelection(ctx, true, "Select closed polyline boundary:");
  if (sel.cancelled || sel.ids.length === 0) return;
  const id = sel.ids[0];
  const entity = adapter.getEntityById(id);
  if (!entity) return ctx.prompter.log("Entidad no encontrada.");
  // Construir el loop a partir de los vértices de la polilínea.
  const loop = buildLoopFromEntity(entity);
  if (!loop) {
    ctx.prompter.log("La entidad seleccionada no es un contorno válido (se espera polyline cerrada).");
    return;
  }  const hatch = new AcDbHatch();
  hatch.patternType = AcDbHatchPatternType.Predefined;
  hatch.patternName = patternName;
  hatch.patternScale = scale;
  hatch.patternAngle = (angleDeg * Math.PI) / 180;
  hatch.add(loop);
  addWithUndo(ctx, hatch);
  ctx.prompter.log(`Hatch: pattern=${patternName} scale=${scale}`);
}

/**
 * Construye un AcGePolyline2d (loop) desde una entidad AcDbPolyline.
 * TODO(hatch): soportar contornos compuestos por líneas/círculos (AcGeLoop2d con edges).
 */
function buildLoopFromEntity(entity: AcDbEntity): AcGePolyline2d | null {
  if (!(entity instanceof AcDbPolyline)) return null;
  const poly = entity;
  const n = poly.numberOfVertices;
  if (n < 3) return null;
  const verts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p = poly.getPoint2dAt(i);
    verts.push({ x: p.x, y: p.y });
  }
  return new AcGePolyline2d(verts, true);
}

/**
 * Pide un string al usuario vía el editor del visor (getString).
 * Devuelve null si se cancela. Usado por TEXT/MTEXT.
 */
async function promptString(ctx: Parameters<CadCommand["run"]>[0], message: string): Promise<string | null> {
  const editor = ctx.adapter?.editor;
  if (!editor) return null;
  const { AcEdPromptStringOptions, AcEdPromptStatus } = await import("@mlightcad/cad-simple-viewer");
  const opts = new AcEdPromptStringOptions(message);
  ctx.prompter.prompt(message);
  const res = await editor.getString(opts);
  ctx.prompter.clearPrompt();
  if (res.status !== AcEdPromptStatus.OK) return null;
  return res.stringResult ?? null;
}

// --- WIPEOUT ---
const wipeoutCommand: CadCommand = {
  id: "WIPEOUT",
  aliases: [],
  label: "Wipeout",
  group: "annotate",
  icon: "wipeout",
  tooltip: "Wipeout mask",
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
    const wipeout = new AcDbWipeout();
    // TODO(wipeout): cablear clipBoundary/clipBoundaryType correctamente.
    // Por ahora se posiciona como rectángulo; el render propio rellena de fondo.
    wipeout.position = new AcGePoint3d(x1, y1, 0);
    wipeout.width = x2 - x1;
    wipeout.height = y2 - y1;
    addWithUndo(ctx, wipeout);
    ctx.prompter.log(`Wipeout: (${x1},${y1}) - (${x2},${y2})`);
  },
};

export function registerAnnotationCommands(): void {
  registry.register(textCommand);
  registry.register(mtextCommand);
  registry.register(hatchSolidCommand);
  registry.register(hatchAnsi31Command);
  registry.register(wipeoutCommand);
}
