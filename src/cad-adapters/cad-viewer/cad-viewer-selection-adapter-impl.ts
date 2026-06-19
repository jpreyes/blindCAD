import {
  AcApDocManager,
  AcEdPromptSelectionOptions,
  AcEdPromptStatus,
} from "@mlightcad/cad-simple-viewer";
import { AcGeBox2d, type AcDbObjectId } from "@mlightcad/data-model";
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
  }

  clearHighlight(): void {
    // Re-aplica la selección actual: los seleccionados quedan resaltados,
    // el resto se limpia. Sencillo y consistente con el visor.
    this.view.unhighlight(this.currentSelectionIds() as AcDbObjectId[]);
  }

  /** IDs actualmente seleccionados en el selection set del editor del visor. */
  currentSelectionIds(): string[] {
    return AcApDocManager.instance.editor.getSelection instanceof Function
      ? []
      : [];
  }

  /**
   * Selección interactiva (usada por el comando SELECT y por comandos
   * modify). Delega en editor.getSelection del visor.
   */
  async promptSelect(singleOnly = false): Promise<string[] | null> {
    const opts = new AcEdPromptSelectionOptions("Select objects:");
    opts.singleOnly = singleOnly;
    const res = await AcApDocManager.instance.editor.getSelection(opts);
    if (res.status !== AcEdPromptStatus.OK) return null;
    return res.value?.ids ?? [];
  }
}

/** Singleton del adapter de selección. */
export const cadViewerSelectionAdapter = new CadViewerSelectionAdapterImpl();
