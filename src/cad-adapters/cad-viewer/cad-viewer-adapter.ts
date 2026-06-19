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
import type { AcDbEntity, AcDbObjectId } from "@mlightcad/data-model";
import type { AcEditor } from "@mlightcad/cad-simple-viewer";

export interface CadEntity {
  id: EntityId;
  type: string;
  layer: string;
  color?: string;
  geometry: unknown;
}

export interface CadViewerAdapter {
  loadFile(file: File): Promise<boolean>;
  loadUrl(url: string): Promise<boolean>;
  getEntities(): CadEntity[];
  addEntity(entity: CadEntity): void;
  /** Añade una entidad nativa AcDbEntity a la database + vista. */
  addNativeEntity(entity: AcDbEntity): AcDbObjectId;
  updateEntity(entity: CadEntity): void;
  removeEntity(id: EntityId): void;
  removeNativeEntity(id: EntityId): void;
  refresh(): void;
  zoomExtents(): void;
  zoomWindow(p1: Point, p2: Point): void;
  pan(dx: number, dy: number): void;
  regen(): void;
  /** Editor del visor (getPoint/getDistance/...) para comandos interactivos. */
  readonly editor: AcEditor;
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
  updateEntity(entity: CadEntity): void {
    this.entities.set(entity.id, entity);
  }
  removeEntity(id: EntityId): void {
    this.entities.delete(id);
  }
  removeNativeEntity(_id: EntityId): void {
    /* noop */
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
