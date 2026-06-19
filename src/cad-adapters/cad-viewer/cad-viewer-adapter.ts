/**
 * Adapter del motor CAD externo (mlightcad/cad-viewer).
 *
 * Principio AGENTS.md: la app no depende de detalles internos del visor
 * en todos lados. Cualquier dependencia pasa por este adapter.
 *
 * En este paso (scaffold) es una interfaz + stub. El paso 2 cablea
 * la instancia real de @mlightcad/cad-viewer detrás de esta interfaz.
 */
export type { EntityId } from "@/cad-core/command-types";
import type { EntityId, Point } from "@/cad-core/command-types";
import type { AcDbEntity, AcDbLayerTableRecord, AcDbObjectId, AcGeMatrix3d } from "@mlightcad/data-model";
import type { AcEditor } from "@mlightcad/cad-simple-viewer";

export interface CadEntity {
  id: EntityId;
  type: string;
  layer: string;
  color?: string;
  geometry: unknown;
}

export interface LayerInfo {
  name: string;
  isOff: boolean;
  color: number;
}

export interface CadViewerAdapter {
  loadFile(file: File): Promise<boolean>;
  loadUrl(url: string): Promise<boolean>;
  getEntities(): CadEntity[];
  addEntity(entity: CadEntity): void;
  /** Añade una entidad nativa AcDbEntity a la database + vista. */
  addNativeEntity(entity: AcDbEntity): AcDbObjectId;
  /** Re-añade una entidad (para undo de erase). */
  restoreEntity(entity: AcDbEntity): AcDbObjectId;
  updateEntity(entity: CadEntity): void;
  removeEntity(id: EntityId): void;
  removeNativeEntity(id: EntityId): void;
  /** Devuelve la entidad nativa por objectId del model space. */
  getEntityById(id: EntityId): AcDbEntity | undefined;
  /** Aplica una matriz a una entidad y refresca. Devuelve la matriz inversa. */
  transformEntity(id: EntityId, matrix: AcGeMatrix3d): AcGeMatrix3d;
  /** Elimina una entidad. Devuelve un clon (para undo). */
  eraseEntity(id: EntityId): AcDbEntity | undefined;
  /** Clona una entidad y la añade. Devuelve el nuevo objectId. */
  cloneEntity(id: EntityId): AcDbObjectId | undefined;
  refresh(): void;
  zoomExtents(): void;
  zoomWindow(p1: Point, p2: Point): void;
  pan(dx: number, dy: number): void;
  regen(): void;
  /** Editor del visor (getPoint/getDistance/...) para comandos interactivos. */
  readonly editor: AcEditor;
  // --- Capas ---
  /** Lista las capas del documento. */
  listLayers(): LayerInfo[];
  /** Crea una capa con nombre y color RGB. */
  createLayer(name: string, color?: number): AcDbLayerTableRecord;
  /** Activa/desactiva la visibilidad de una capa. */
  setLayerVisible(name: string, visible: boolean): void;
  /** Establece la capa actual. */
  setCurrentLayer(name: string): void;
  /** Devuelve el nombre de la capa actual. */
  getCurrentLayer(): string;
}

/**
 * Stub que satisface la interfaz. Se sustituye en el paso 2 por una
 * implementación que envuelve la instancia del componente cad-viewer.
 */
export class StubCadViewerAdapter implements CadViewerAdapter {
  private entities = new Map<EntityId, CadEntity>();
  get editor(): AcEditor {
    throw new Error("StubCadViewerAdapter: editor no disponible (visor no listo).");
  }

  async loadFile(file: File): Promise<boolean> {
    console.warn(`[StubCadViewerAdapter] loadFile(${file.name}) no implementado`);
    return false;
  }
  async loadUrl(_url: string): Promise<boolean> {
    console.warn(`[StubCadViewerAdapter] loadUrl no implementado`);
    return false;
  }
  getEntities(): CadEntity[] {
    return Array.from(this.entities.values());
  }
  addEntity(entity: CadEntity): void {
    this.entities.set(entity.id, entity);
  }
  addNativeEntity(_entity: AcDbEntity): AcDbObjectId {
    throw new Error("StubCadViewerAdapter: addNativeEntity no implementado.");
  }
  restoreEntity(_entity: AcDbEntity): AcDbObjectId {
    throw new Error("StubCadViewerAdapter: restoreEntity no implementado.");
  }
  updateEntity(entity: CadEntity): void {
    this.entities.set(entity.id, entity);
  }
  removeEntity(id: EntityId): void {
    this.entities.delete(id);
  }
  removeNativeEntity(_id: EntityId): void {
    /* noop */
  }
  getEntityById(_id: EntityId): AcDbEntity | undefined {
    return undefined;
  }
  transformEntity(_id: EntityId, matrix: AcGeMatrix3d): AcGeMatrix3d {
    return matrix;
  }
  eraseEntity(_id: EntityId): AcDbEntity | undefined {
    return undefined;
  }
  cloneEntity(_id: EntityId): AcDbObjectId | undefined {
    return undefined;
  }
  listLayers(): LayerInfo[] {
    return [];
  }
  createLayer(_name: string, _color?: number): AcDbLayerTableRecord {
    throw new Error("StubCadViewerAdapter: createLayer no implementado.");
  }
  setLayerVisible(_name: string, _visible: boolean): void {
    /* noop */
  }
  setCurrentLayer(_name: string): void {
    /* noop */
  }
  getCurrentLayer(): string {
    return "0";
  }
  refresh(): void {
    /* noop */
  }
  zoomExtents(): void {
    /* noop */
  }
  zoomWindow(_p1: Point, _p2: Point): void {
    /* noop */
  }
  pan(_dx: number, _dy: number): void {
    /* noop */
  }
  regen(): void {
    /* noop */
  }
}
