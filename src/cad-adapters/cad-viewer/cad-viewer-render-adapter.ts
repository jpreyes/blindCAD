/**
 * Adapter de render sobre cad-viewer (esqueleto).
 * Aísla operaciones de dibujo/refresh del visor concreto.
 * Se implementa en pasos posteriores (draw/modify/dimensions).
 */
export interface CadViewerRenderAdapter {
  requestRender(): void;
  setLayerVisible(layer: string, visible: boolean): void;
  setView(center: { x: number; y: number }, scale: number): void;
}
