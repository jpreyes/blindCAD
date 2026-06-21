import {
  AcApDocManager,
  AcEdPromptPointOptions,
  AcEdPromptStatus,
} from "@mlightcad/cad-simple-viewer";
import { AcGeBox2d, type AcDbObjectId, type AcGePoint3dLike } from "@mlightcad/data-model";
import type { Point } from "@/cad-core/command-types";
import type { CadViewerSelectionAdapter } from "./cad-viewer-selection-adapter";

/**
 * Implementación real del adapter de selección que envuelve AcApDocManager.
 *
 * El visor ya implementa click/window/crossing internamente. Este adapter
 * expone esa selección al SelectionManager de cad-core (framework-agnostic)
 * para que la UI (panel de propiedades, línea de comando) y los comandos
 * reaccionen sin depender de detalles del visor.
 */
export class CadViewerSelectionAdapterImpl implements CadViewerSelectionAdapter {
  private get view() {
    return AcApDocManager.instance.curView;
  }

  pickAt(x: number, y: number): string[] {
    const results = this.view.pick({ x, y });
    return results.map((r) => r.id);
  }

  windowSelect(p1: Point, p2: Point, crossing: boolean): string[] {
    // search() devuelve entidades cuyo bbox interseca el rectángulo.
    // AutoCAD: window = contenidas, crossing = que intersecan. El visor
    // trata search como crossing por bbox; aquí lo exponemos igual y el
    // SelectionManager decide el modo semántico.
    void crossing; // TODO(selection semántica): filtrar contenidas vs interseca.
    const box = new AcGeBox2d(
      { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
      { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) },
    );
    const results = this.view.search(box);
    return results.map((r) => r.id);
  }

  highlight(ids: string[]): void {
    this.view.highlight(ids as AcDbObjectId[]);
    this.view.selectionSet.add(ids as AcDbObjectId[]);
  }

  clearHighlight(): void {
    const ids = this.currentSelectionIds();
    if (ids.length > 0) {
      this.view.unhighlight(ids as AcDbObjectId[]);
    }
    this.view.selectionSet.clear();
  }

  /** IDs actualmente seleccionados en el selection set del editor del visor. */
  currentSelectionIds(): string[] {
    return this.view.selectionSet.ids;
  }

  /**
   * Selección interactiva (usada por el comando SELECT y por comandos
   * modify). Evita editor.getSelection porque en el visor embebido devuelve
   * vacío inmediatamente; usamos puntos + pick y mantenemos el selection set.
   */
  async promptSelect(singleOnly = false): Promise<string[] | null> {
    this.clearHighlight();
    const editor = AcApDocManager.instance.editor;
    const selected = new Set<string>();

    while (true) {
      const opts = new AcEdPromptPointOptions(
        singleOnly ? "Select object:" : "Select objects or press ESC/Enter to finish:",
      );
      opts.allowNone = true;
      opts.disableOSnap = true;
      const res = await editor.getPoint(opts);

      if (res.status !== AcEdPromptStatus.OK || !res.value) {
        return selected.size > 0 ? [...selected] : null;
      }

      const point = res.value as AcGePoint3dLike;
      const hits = this.view.pick({ x: point.x, y: point.y }, undefined, singleOnly);
      const ids = hits.map((hit) => hit.id).filter((id) => !selected.has(id));
      if (ids.length === 0) continue;

      const idsToAdd = singleOnly ? [ids[0]] : ids;
      idsToAdd.forEach((id) => selected.add(id));
      this.view.applySelection(idsToAdd as AcDbObjectId[], "add");

      if (singleOnly) return [...selected];
    }
  }
}

/** Singleton del adapter de selección. */
export const cadViewerSelectionAdapter = new CadViewerSelectionAdapterImpl();
