import {
  AcApDocManager,
  AcEdOpenMode,
  type AcApOpenDatabaseOptions,
} from "@mlightcad/cad-simple-viewer";
import { AcGeBox2d, AcGePoint2d } from "@mlightcad/data-model";
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
    // TODO(draw/modify): exponer entidades del curDocument.database.
    return [];
  }

  addEntity(_entity: CadEntity): void {
    // TODO(draw): usar curView.addEntity(entity) con AcDbEntity del data-model.
  }

  updateEntity(_entity: CadEntity): void {
    // TODO(modify): usar curView.updateEntity(entity).
  }

  removeEntity(_id: EntityId): void {
    // TODO(modify): usar curView.removeEntity(entity).
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
