import {
  AcDbBlockReference,
  AcDbLine,
  AcDbMLine,
  AcDbMLineJustification,
  AcDbPolyline,
  AcDbViewport,
  AcGeBox2d,
  AcGePoint2d,
  AcGePoint3d,
  AcGeVector3d,
  acdbHostApplicationServices,
} from "@mlightcad/data-model";
import type { CadCommand, CommandArgs, EntityId, Point } from "../command-types";
import type { AcDbEntity } from "@mlightcad/data-model";
import { registry } from "../command-registry";
import { getPoint } from "@/cad-core/input/point-input";
import { pickSelection } from "@/cad-core/selection/selection-utils";

/**
 * Comandos de layout, viewport, multiline y export (Paso 9 - MVP3).
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
    ctx.transactions.run({ name: "DRAW", do: doAdd, undo: undoAdd });
  } else {
    doAdd();
  }
  return id;
}

// --- MULTILINE ---
const multilineCommand: CadCommand = {
  id: "MULTILINE",
  aliases: ["ML"],
  label: "Multiline",
  group: "draw",
  icon: "multiline",
  tooltip: "Multiline - Alias: ML",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const first = await getPoint(ctx, "Specify start point:");
    if (first.cancelled) return ctx.prompter.log("*Cancel*");
    const mline = new AcDbMLine();
    mline.justification = AcDbMLineJustification.Zero;
    mline.scale = 1;
    mline.styleCount = 2;
    mline.startPosition = p3(first.point);
    let prev = first.point;
    while (true) {
      const next = await getPoint(ctx, "Specify next point:", prev);
      if (next.cancelled) {
        if (mline.vertexCount >= 1) {
          addWithUndo(ctx, mline);
          ctx.prompter.log(`Multiline: ${mline.vertexCount + 1} vertices.`);
        } else {
          ctx.prompter.log("*Cancel*");
        }
        return;
      }
      // Calcular dirección y miter del segmento.
      const dir = new AcGeVector3d(next.point.x - prev.x, next.point.y - prev.y, 0).normalize();
      // Miter direction: perpendicular a la dirección (offset de los elementos).
      const miter = new AcGeVector3d(-dir.y, dir.x, 0);
      mline.appendSegment({
        position: p3(next.point),
        direction: dir,
        miterDirection: miter,
        elements: [{ parameters: [-0.5] }, { parameters: [0.5] }],
      });
      prev = next.point;
    }
  },
};

// --- LAYOUT ---
const layoutCommand: CadCommand = {
  id: "LAYOUT",
  aliases: [],
  label: "Layout",
  group: "layout",
  icon: "layout",
  tooltip: "Create paper space layout",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    ctx.prompter.prompt("Layout name [A1/A2/A3/A4]:");
    // Simplificación: crear layout con nombre por defecto.
    const existing = adapter.listLayouts();
    const name = `Layout${existing.length + 1}`;
    const { layout, btr } = adapter.createLayout(name);
    // Tamaño A3 por defecto (420x297mm en paper space).
    layout.limits = new AcGeBox2d({ x: 0, y: 0 }, { x: 420, y: 297 });
    void btr;
    ctx.prompter.clearPrompt();
    ctx.prompter.log(`Layout "${name}" creado (${existing.length + 1} layout(s) total).`);
  },
};

// --- VIEWPORT ---
const viewportCommand: CadCommand = {
  id: "VIEWPORT",
  aliases: ["MV"],
  label: "Viewport",
  group: "layout",
  icon: "viewport",
  tooltip: "Create viewport - Alias: MV",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const layouts = adapter.listLayouts();
    if (layouts.length === 0) {
      ctx.prompter.log("No hay layouts. Crea un layout primero (comando LAYOUT).");
      return;
    }
    // TODO(viewport): permitir elegir layout. Por ahora usa el último creado.
    const name = layouts[layouts.length - 1];
    const p1 = await getPoint(ctx, "Specify first corner of viewport:");
    if (p1.cancelled) return ctx.prompter.log("*Cancel*");
    const p2 = await getPoint(ctx, "Specify opposite corner:", p1.point);
    if (p2.cancelled) return ctx.prompter.log("*Cancel*");
    const x1 = Math.min(p1.point.x, p2.point.x);
    const y1 = Math.min(p1.point.y, p2.point.y);
    const w = Math.abs(p2.point.x - p1.point.x);
    const h = Math.abs(p2.point.y - p1.point.y);
    const vp = new AcDbViewport();
    vp.centerPoint = new AcGePoint3d(x1 + w / 2, y1 + h / 2, 0);
    vp.width = w;
    vp.height = h;
    vp.viewCenter = new AcGePoint3d(0, 0, 0);
    vp.viewHeight = h * 50; // escala aprox 1:50 por defecto
    // Añadir al paper space del layout. Necesitamos el btr del layout.
    const lm = acdbHostApplicationServices().layoutManager;
    const layout = lm.findLayoutNamed(name, adapter.database);
    if (!layout || !layout.blockTableRecordId) {
      ctx.prompter.log("No se pudo resolver el BTR del layout.");
      return;
    }
    const btr = adapter.database.tables.blockTable.getIdAt(layout.blockTableRecordId);
    if (!btr) {
      ctx.prompter.log("BTR del layout no encontrado.");
      return;
    }
    adapter.addViewport(btr, vp);
    ctx.prompter.log(`Viewport creado: ${w}x${h} (escala ~1:50).`);
  },
};

// --- VIEWPORT_SCALE ---
const viewportScaleCommand: CadCommand = {
  id: "VIEWPORT_SCALE",
  aliases: [],
  label: "Viewport Scale",
  group: "layout",
  icon: "viewport-scale",
  tooltip: "Set viewport scale (1:n)",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const sel = await pickSelection(ctx, true, "Select viewport:");
    if (sel.cancelled || sel.ids.length === 0) return;
    const entity = adapter.getEntityById(sel.ids[0]);
    if (!entity) return ctx.prompter.log("Entidad no encontrada.");
    const { AcDbViewport } = await import("@mlightcad/data-model");
    if (!(entity instanceof AcDbViewport)) {
      ctx.prompter.log("Selecciona un viewport.");
      return;
    }
    const vp = entity;
    const editor = ctx.adapter?.editor;
    if (!editor) return;
    const { AcEdPromptDoubleOptions, AcEdPromptStatus } = await import("@mlightcad/cad-simple-viewer");
    const opts = new AcEdPromptDoubleOptions("Specify scale factor (1:n, enter n):");
    ctx.prompter.prompt("Specify scale factor (1:n, enter n):");
    const res = await editor.getDouble(opts);
    ctx.prompter.clearPrompt();
    if (res.status !== AcEdPromptStatus.OK || !res.value) return ctx.prompter.log("*Cancel*");
    const n = res.value;
    if (n <= 0) return ctx.prompter.log("Factor no válido.");
    // Escala = paper height / view height. viewHeight = paperHeight * n.
    vp.viewHeight = vp.height * n;
    adapter.refresh();
    ctx.prompter.log(`Viewport scale: 1:${n}`);
  },
};

// --- VIEWPORT_LOCK ---
const viewportLockCommand: CadCommand = {
  id: "VIEWPORT_LOCK",
  aliases: [],
  label: "Viewport Lock",
  group: "layout",
  icon: "viewport-lock",
  tooltip: "Lock/unlock viewport (display only)",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const sel = await pickSelection(ctx, true, "Select viewport to lock/unlock:");
    if (sel.cancelled || sel.ids.length === 0) return;
    const entity = adapter.getEntityById(sel.ids[0]);
    if (!entity) return ctx.prompter.log("Entidad no encontrada.");
    const { AcDbViewport } = await import("@mlightcad/data-model");
    if (!(entity instanceof AcDbViewport)) {
      ctx.prompter.log("Selecciona un viewport.");
      return;
    }
    // AcDbViewport no tiene propiedad locked nativa; se gestiona a nivel app.
    // Registramos el estado en un Set del adapter (TODO: persistir).
    const locked = viewportLockState.has(sel.ids[0]);
    if (locked) {
      viewportLockState.delete(sel.ids[0]);
      ctx.prompter.log("Viewport desbloqueado.");
    } else {
      viewportLockState.add(sel.ids[0]);
      ctx.prompter.log("Viewport bloqueado.");
    }
  },
};

/** Estado de bloqueo de viewports (en memoria; TODO persistir). */
const viewportLockState = new Set<string>();

// --- TITLE_BLOCK ---
const titleBlockCommand: CadCommand = {
  id: "TITLE_BLOCK",
  aliases: [],
  label: "Title Block",
  group: "layout",
  icon: "title-block",
  tooltip: "Insert title block",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const name = "TITLE_BLOCK";
    if (!adapter.hasBlock(name)) {
      // Crear un cajetín A3 simple (rectángulo + línea divisoria).
      const poly = new AcDbPolyline();
      poly.addVertexAt(0, new AcGePoint2d(0, 0));
      poly.addVertexAt(1, new AcGePoint2d(420, 0));
      poly.addVertexAt(2, new AcGePoint2d(420, 297));
      poly.addVertexAt(3, new AcGePoint2d(0, 297));
      poly.closed = true;
      // Línea divisoria del cajetín (borde inferior 40mm).
      const div = new AcDbLine(new AcGePoint3d(0, 40, 0), new AcGePoint3d(420, 40, 0));
      adapter.createBlock(name, { x: 0, y: 0 }, [poly, div]);
      ctx.prompter.log("Block TITLE_BLOCK creado (cajetín A3 simple).");
    }
    const pos = await getPoint(ctx, "Specify title block insertion point:");
    if (pos.cancelled) return ctx.prompter.log("*Cancel*");
    const ref = new AcDbBlockReference(name);
    ref.position = p3(pos.point);
    addWithUndo(ctx, ref);
    ctx.prompter.log(`Title block insertado en (${pos.point.x},${pos.point.y}).`);
  },
};

// --- EXPORT_DXF ---
const exportDxfCommand: CadCommand = {
  id: "EXPORT_DXF",
  aliases: [],
  label: "Export DXF",
  group: "file",
  icon: "export-dxf",
  tooltip: "Export drawing to DXF",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    ctx.prompter.log("Exportando DXF...");
    const dxf = adapter.exportDxf(6);
    // Descargar como archivo.
    const blob = new Blob([dxf], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "drawing.dxf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    ctx.prompter.log(`DXF exportado (${(dxf.length / 1024).toFixed(1)} KB).`);
  },
};

// --- PRINT_PDF ---
const printPdfCommand: CadCommand = {
  id: "PRINT_PDF",
  aliases: [],
  label: "Print PDF",
  group: "file",
  icon: "print-pdf",
  tooltip: "Export drawing to PDF",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    ctx.prompter.log("Generando PDF...");
    try {
      await adapter.exportPdf();
      ctx.prompter.log("PDF exportado.");
    } catch (err) {
      ctx.prompter.log(`Error exportando PDF: ${String(err)}`);
    }
  },
};

export function registerLayoutCommands(): void {
  registry.register(multilineCommand);
  registry.register(layoutCommand);
  registry.register(viewportCommand);
  registry.register(viewportScaleCommand);
  registry.register(viewportLockCommand);
  registry.register(titleBlockCommand);
  registry.register(exportDxfCommand);
  registry.register(printPdfCommand);
}
