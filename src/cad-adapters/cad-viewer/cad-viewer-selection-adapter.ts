/**
 * Adapter de selección sobre cad-viewer (esqueleto).
 * Traduce picks/window del visor al SelectionManager de cad-core.
 * Se implementa en el paso 3 (Selection + OSNAP).
 */
export interface CadViewerSelectionAdapter {
  pickAt(x: number, y: number): string[];
  windowSelect(p1: { x: number; y: number }, p2: { x: number; y: number }, crossing: boolean): string[];
  highlight(ids: string[]): void;
  clearHighlight(): void;
  /** Selección interactiva compartida por comandos. null = cancelado/sin selección. */
  promptSelect(singleOnly?: boolean): Promise<string[] | null>;
}
