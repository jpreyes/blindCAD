/**
 * Diálogo de apertura de archivos.
 *
 * Estrategia AGENTS.md: usar File System Access API cuando esté disponible,
 * con fallback a <input type=file> para navegadores sin soporte completo
 * (Safari, móviles, etc.). No asumir acceso completo al filesystem.
 */

export interface PickedFile {
  file: File;
}

/**
 * Abre un diálogo nativo de selección de archivo.
 * @param accept extensiones acceptadas, p.ej. ".dxf,.dwg" o ".dxf"
 * @returns el archivo elegido o undefined si el usuario cancela.
 */
export async function openFileDialog(accept: string): Promise<PickedFile | undefined> {
  // File System Access API (Chromium, desktop).
  const w = window as Window & {
    showOpenFilePicker?: (opts: {
      types: { description?: string; accept: Record<string, string[]> }[];
      multiple?: boolean;
    }) => Promise<FileSystemFileHandle[]>;
  };
  if (typeof w.showOpenFilePicker === "function") {
    try {
      const [handle] = await w.showOpenFilePicker({
        types: [
          {
            description: "CAD drawing",
            accept: { "application/octet-stream": accept.split(",").map((e) => e.trim()) },
          },
        ],
        multiple: false,
      });
      const file = await handle.getFile();
      return { file };
    } catch (err) {
      // El usuario canceló (AbortError) → undefined.
      if (err instanceof DOMException && err.name === "AbortError") return undefined;
      // Otro error → caer al fallback.
    }
  }
  // Fallback con <input type=file>.
  return openFileViaInput(accept);
}

function openFileViaInput(accept: string): Promise<PickedFile | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.onchange = () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      resolve(file ? { file } : undefined);
    };
    // Si el diálogo se cierra sin elegir, no hay evento confiable; el usuario
    // puede simplemente volver a lanzar el comando.
    document.body.appendChild(input);
    input.click();
  });
}
