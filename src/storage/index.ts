/**
 * Capa de persistencia (esqueleto).
 * Estrategia AGENTS.md:
 *   drawing.dwg / drawing.cadstruct.json / drawing.pdf / drawing.dxf
 * - File System Access API cuando esté disponible.
 * - IndexedDB para proyectos recientes.
 * - Fallback con input/download para navegadores sin soporte completo.
 *
 * Se implementa en pasos posteriores (Export PDF/DXF + persistencia).
 */

export interface CadStructProject {
  version: string;
  sourceFile?: string;
  entities: unknown[];
  dimensions: unknown[];
  hatches: unknown[];
  blocks: unknown[];
  layouts: unknown[];
  viewports: unknown[];
  structuralObjects: unknown[];
  layerStates: unknown[];
  settings: Record<string, unknown>;
}

export const PROJECT_VERSION = "0.1.0";

export function emptyProject(): CadStructProject {
  return {
    version: PROJECT_VERSION,
    entities: [],
    dimensions: [],
    hatches: [],
    blocks: [],
    layouts: [],
    viewports: [],
    structuralObjects: [],
    layerStates: [],
    settings: {},
  };
}
