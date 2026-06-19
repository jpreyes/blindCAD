import {
  AcApDocManager,
  AcEdOpenMode,
  type AcApOpenDatabaseOptions,
} from "@mlightcad/cad-simple-viewer";
import {
  AcGeBox2d,
  AcGeMatrix3d,
  AcGePoint2d,
  type AcDbEntity,
  type AcDbObjectId,
} from "@mlightcad/data-model";
import type { EntityId, Point } from "@/cad-core/command-types";
import type { CadEntity, CadViewerAdapter } from "./cad-viewer-adapter";

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
}

/** Singleton del adapter, cableado por el componente CadViewer. */
export const cadViewerAdapter = new CadViewerAdapterImpl();
