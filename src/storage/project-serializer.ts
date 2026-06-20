import type { AcDbDatabase } from "@mlightcad/data-model";
import type { CadStructProject } from "./index";
import { PROJECT_VERSION } from "./index";

/**
 * Serializador de proyecto (sidecar .cadstruct.json).
 *
 * Estrategia AGENTS.md: no depender de guardar DWG perfecto. Se guarda:
 *   drawing.dwg / drawing.cadstruct.json / drawing.pdf / drawing.dxf
 *
 * El cadstruct.json guarda metadatos + el DXF embebido (contenido completo
 * del dibujo serializado por la database). Esto permite reabrir el proyecto
 * en cualquier navegador sin el archivo DWG original.
 */

/** Construye el objeto proyecto desde la database actual. */
export function serializeProject(
  database: AcDbDatabase,
  sourceFile?: string,
): CadStructProject {
  const dxf = database.dxfOut(undefined, 6);
  return {
    version: PROJECT_VERSION,
    sourceFile,
    entities: [],
    dimensions: [],
    hatches: [],
    blocks: [],
    layouts: [],
    viewports: [],
    structuralObjects: [],
    layerStates: [],
    settings: { dxf },
  };
}

/** Descarga un archivo en el navegador (fallback universal). */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Guarda el proyecto como .cadstruct.json usando File System Access API
 * si está disponible, con fallback a descarga del navegador.
 */
export async function saveProjectFile(
  project: CadStructProject,
  suggestedName = "drawing.cadstruct.json",
): Promise<string | undefined> {
  const json = JSON.stringify(project, null, 2);
  const w = window as Window & {
    showSaveFilePicker?: (opts: {
      suggestedName?: string;
      types: { description?: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
  };
  if (typeof w.showSaveFilePicker === "function") {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: "blindCAD project",
            accept: { "application/json": [".cadstruct.json", ".json"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return handle.name;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return undefined;
    }
  }
  downloadFile(suggestedName, json, "application/json");
  return suggestedName;
}
