import {
  AcApDocManager,
  AcEdOpenMode,
  type AcApOpenDatabaseOptions,
} from "@mlightcad/cad-simple-viewer";
import {
  AcCmColor,
  AcCmColorMethod,
  AcCmTransparency,
  AcDbBlockTableRecord,
  AcDbLayerTableRecord,
  type AcDbDimension,
  type AcDbEntity,
  type AcDbLayout,
  type AcDbObjectId,
  type AcDbViewport,
  AcGeBox2d,
  AcGeMatrix3d,
  AcGePoint2d,
  AcGePoint3d,
  acdbHostApplicationServices,
} from "@mlightcad/data-model";
import type { EntityId, Point } from "@/cad-core/command-types";
import type { CadEntity, CadViewerAdapter, LayerInfo } from "./cad-viewer-adapter";

/**
 * Implementación real de CadViewerAdapter que envuelve al singleton
 * AcApDocManager de @mlightcad/cad-simple-viewer.
 *
 * Principio AGENTS.md: la app no depende de detalles internos del visor
 * en todos lados. Cualquier dependencia pasa por este adapter.
 *
 * El docManager es creado por el componente MlCadViewer al montar. Antes
 * de eso, los métodos que lo requieren lanzan/no-op. El componente Vue
 * CadViewer llama a bind() en el evento `create` del visor.
 */
export class CadViewerAdapterImpl implements CadViewerAdapter {
  private bound = false;
  private dimBlockCounter = 0;

  /** Marca el adapter como listo (docManager disponible). */
  bind(): void {
    this.bound = true;
  }

  get ready(): boolean {
    return this.bound;
  }

  private get doc() {
    return AcApDocManager.instance;
  }

  /** Acceso al editor del visor (getPoint/getDistance/...) para comandos draw. */
  get editor() {
    return this.doc.editor;
  }

  /** Database del documento actual. */
  get database() {
    return this.doc.curDocument.database;
  }

  async loadFile(file: File): Promise<boolean> {
    const buffer = await file.arrayBuffer();
    const options: AcApOpenDatabaseOptions = { mode: AcEdOpenMode.Write };
    return this.doc.openDocument(file.name, buffer, options);
  }

  async loadUrl(url: string): Promise<boolean> {
    const options: AcApOpenDatabaseOptions = { mode: AcEdOpenMode.Write };
    return this.doc.openUrl(url, options);
  }

  getEntities(): CadEntity[] {
    // TODO(modify): exponer entidades del curDocument.database.modelSpace.
    return [];
  }

  addEntity(_entity: CadEntity): void {
    // No usado: preferir addNativeEntity para entidades AcDbEntity reales.
  }

  /**
   * Añade una entidad nativa AcDbEntity a la database (model space) y a la
   * vista. Devuelve el objectId asignado. Usado por los comandos draw.
   */
  addNativeEntity(entity: AcDbEntity): AcDbObjectId {
    const btr = this.database.tables.blockTable.modelSpace;
    btr.appendEntity(entity);
    this.doc.curView.addEntity(entity);
    return entity.objectId;
  }

  updateEntity(_entity: CadEntity): void {
    // TODO(modify): usar curView.updateEntity(entity).
  }

  /**
   * Elimina una entidad por objectId (database + vista).
   */
  removeNativeEntity(id: EntityId): void {
    const btr = this.database.tables.blockTable.modelSpace;
    btr.removeEntity(id as AcDbObjectId);
    // La vista se actualiza vía eventos de la database.
  }

  removeEntity(id: EntityId): void {
    this.removeNativeEntity(id);
  }

  /** Devuelve la entidad nativa por objectId del model space. */
  getEntityById(id: EntityId): AcDbEntity | undefined {
    return this.database.tables.blockTable.modelSpace.getIdAt(id as AcDbObjectId);
  }

  /**
   * Aplica una matriz de transformación a una entidad y refresca la vista.
   * Devuelve la matriz inversa (útil para undo).
   */
  transformEntity(id: EntityId, matrix: AcGeMatrix3d): AcGeMatrix3d {
    const entity = this.getEntityById(id);
    if (!entity) throw new Error(`Entidad no encontrada: ${id}`);
    entity.transformBy(matrix);
    this.doc.curView.updateEntity(entity);
    this.refresh();
    return matrix.clone().invert();
  }

  /** Elimina una entidad de la database + vista. Devuelve un clon (para undo). */
  eraseEntity(id: EntityId): AcDbEntity | undefined {
    const entity = this.getEntityById(id);
    if (!entity) return undefined;
    const snapshot = entity.clone();
    entity.erase();
    this.refresh();
    return snapshot;
  }

  /** Re-añade una entidad (para undo de erase). */
  restoreEntity(entity: AcDbEntity): AcDbObjectId {
    return this.addNativeEntity(entity);
  }

  /**
   * Clona una entidad y la añade (para COPY). Devuelve el nuevo objectId.
   */
  cloneEntity(id: EntityId): AcDbObjectId | undefined {
    const entity = this.getEntityById(id);
    if (!entity) return undefined;
    const copy = entity.clone();
    return this.addNativeEntity(copy);
  }

  /**
   * Añade una entidad de dimensión a la database + vista.
   * Las dimensiones aligned/rotated requieren un "dim block" (sub-entidades
   * gráficas: flechas, líneas, texto). Las angulares se renderizan vía draw.
   * Sigue el patrón del visor:
   *   blockTable.add(dim.createDimBlock(name)); dim.dimBlockId = name;
   *   modelSpace.appendEntity(dim); view.addEntity(dim);
   */
  addDimension(dim: AcDbDimension): AcDbObjectId {
    const blockTable = this.database.tables.blockTable;
    // createDimBlock solo existe en AcDbAlignedDimension (y sus subclases).
    // AcDb3PointAngularDimension no lo tiene; se renderiza vía draw directo.
    const hasDimBlock = typeof (dim as unknown as { createDimBlock?: unknown }).createDimBlock === "function";
    if (hasDimBlock) {
      const name = `*UDIM${++this.dimBlockCounter}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blockTable.add((dim as any).createDimBlock(name));
      dim.dimBlockId = name;
    }
    const btr = blockTable.modelSpace;
    btr.appendEntity(dim);
    this.doc.curView.addEntity(dim);
    return dim.objectId;
  }

  refresh(): void {
    if (!this.bound) return;
    this.doc.curView.isDirty = true;
  }

  zoomExtents(): void {
    if (!this.bound) return;
    this.doc.curView.zoomToFitDrawing();
  }

  zoomWindow(p1: Point, p2: Point): void {
    if (!this.bound) return;
    const box = new AcGeBox2d(
      { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
      { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) },
    );
    this.doc.curView.zoomTo(box);
  }

  pan(dx: number, dy: number): void {
    if (!this.bound) return;
    const c = this.doc.curView.center;
    this.doc.curView.center = new AcGePoint2d(c.x + dx, c.y + dy);
  }

  regen(): void {
    if (!this.bound) return;
    this.doc.regen();
  }

  // --- Capas ---
  private get layerTable() {
    return this.database.tables.layerTable;
  }

  listLayers(): LayerInfo[] {
    const out: LayerInfo[] = [];
    const it = this.layerTable.newIterator();
    for (const rec of it) {
      out.push({
        name: rec.name,
        isOff: rec.isOff,
        color: rec.color.RGB ?? 0xffffff,
      });
    }
    return out;
  }

  createLayer(name: string, color = 0xffffff): AcDbLayerTableRecord {
    if (this.layerTable.has(name)) {
      const existing = this.layerTable.getAt(name);
      if (existing) return existing;
    }
    const colorObj = new AcCmColor(AcCmColorMethod.ByColor, color);
    const record = new AcDbLayerTableRecord({
      name,
      color: colorObj,
      isOff: false,
      isPlottable: true,
      linetype: "Continuous",
      lineWeight: 0,
      transparency: new AcCmTransparency(),
      standardFlags: 0,
    });
    this.layerTable.add(record);
    this.doc.curView.addLayer(record);
    return record;
  }

  setLayerVisible(name: string, visible: boolean): void {
    const rec = this.layerTable.getAt(name);
    if (!rec) return;
    rec.isOff = !visible;
    this.doc.curView.updateLayer(rec, { isOff: !visible });
    this.refresh();
  }

  setCurrentLayer(name: string): void {
    this.database.clayer = name;
  }

  getCurrentLayer(): string {
    return this.database.clayer;
  }

  // --- Blocks ---
  createBlock(name: string, basePoint: Point, entities: AcDbEntity[]): AcDbBlockTableRecord {
    const btr = new AcDbBlockTableRecord();
    btr.name = name;
    btr.origin = new AcGePoint3d(basePoint.x, basePoint.y, basePoint.z ?? 0);
    btr.appendEntity(entities);
    this.database.tables.blockTable.add(btr);
    return btr;
  }

  hasBlock(name: string): boolean {
    return this.database.tables.blockTable.has(name);
  }

  listBlocks(): string[] {
    const out: string[] = [];
    const it = this.database.tables.blockTable.newIterator();
    for (const rec of it) {
      // Excluir *Model_Space y *Paper_Space de la lista de bloques de usuario.
      if (!AcDbBlockTableRecord.isModelSapceName(rec.name) && !AcDbBlockTableRecord.isPaperSapceName(rec.name)) {
        out.push(rec.name);
      }
    }
    return out;
  }

  // --- Layouts / viewports ---
  createLayout(name: string): { layout: AcDbLayout; btr: AcDbBlockTableRecord } {
    const lm = acdbHostApplicationServices().layoutManager;
    const result = lm.createLayout(name, this.database);
    this.doc.curView.addLayout(result.layout);
    return result;
  }

  listLayouts(): string[] {
    const lm = acdbHostApplicationServices().layoutManager;
    const out: string[] = [];
    const dict = this.database.objects.layout;
    const it = dict.newIterator();
    for (const [key] of it as unknown as Iterable<[string, AcDbLayout]>) {
      out.push(key);
    }
    void lm;
    return out;
  }

  setCurrentLayout(name: string): boolean {
    const lm = acdbHostApplicationServices().layoutManager;
    const ok = lm.setCurrentLayout(name, this.database);
    if (ok) this.doc.setActiveLayout();
    return ok;
  }

  addViewport(layoutBtr: AcDbBlockTableRecord, viewport: AcDbViewport): void {
    layoutBtr.appendEntity(viewport);
    this.refresh();
  }

  // --- Export ---
  exportDxf(precision = 6): string {
    return this.database.dxfOut(undefined, precision);
  }

  async exportPdf(): Promise<void> {
    const { AcApPdfConvertor } = await import("@mlightcad/cad-pdf-plugin");
    const convertor = new AcApPdfConvertor();
    await convertor.convert(this.doc.context);
  }
}

/** Singleton del adapter, cableado por el componente CadViewer. */
export const cadViewerAdapter = new CadViewerAdapterImpl();
