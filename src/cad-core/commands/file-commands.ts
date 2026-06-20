import type { CadCommand, CommandArgs } from "../command-types";
import { registry } from "../command-registry";
import { openFileDialog } from "@/storage/file-dialog";
import { serializeProject, saveProjectFile } from "@/storage/project-serializer";
import { saveRecentProject, type RecentProject } from "@/storage/indexed-db";

/**
 * Comandos de archivo (Paso 2).
 * OPEN / LOAD_DXF / LOAD_DWG cargan dibujos a través del CadViewerAdapter,
 * que delega en AcApDocManager (@mlightcad/cad-simple-viewer).
 * SAVE_PROJECT queda como stub (se implementa en el paso de persistencia).
 *
 * Regla AGENTS.md: la UI solo llama a commandBus.run(ID). Sin lógica duplicada.
 */

function extOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i >= 0 ? fileName.slice(i).toLowerCase() : "";
}

function makeLoadCommand(id: string, accept: string, exts: string[]): CadCommand {
  return {
    id,
    aliases: [],
    label: id === "OPEN" ? "Open" : id === "LOAD_DXF" ? "Load DXF" : "Load DWG",
    group: "file",
    icon: id === "OPEN" ? "open" : id === "LOAD_DXF" ? "dxf" : "dwg",
    tooltip:
      id === "OPEN"
        ? "Open drawing (DWG/DXF)"
        : id === "LOAD_DXF"
          ? "Load DXF file"
          : "Load DWG file",
    async run(ctx, _args?: CommandArgs): Promise<void> {
      const adapter = ctx.adapter;
      if (!adapter) {
        ctx.prompter.log("Visor no disponible aún.");
        return;
      }
      ctx.prompter.prompt("Select drawing file:");
      const picked = await openFileDialog(accept);
      ctx.prompter.clearPrompt();
      if (!picked) {
        ctx.prompter.log("*Cancel*");
        return;
      }
      if (exts.length > 0 && !exts.includes(extOf(picked.file.name))) {
        ctx.prompter.log(
          `Archivo no válido: "${picked.file.name}". Extensiones: ${exts.join(", ")}`,
        );
        return;
      }
      ctx.prompter.log(`Abriendo "${picked.file.name}"...`);
      const ok = await adapter.loadFile(picked.file);
      if (ok) {
        ctx.prompter.log(`"${picked.file.name}" cargado correctamente.`);
        adapter.zoomExtents();
      } else {
        ctx.prompter.log(`No se pudo abrir "${picked.file.name}".`);
      }
    },
  };
}

export function registerFileCommands(): void {
  registry.register(makeLoadCommand("OPEN", ".dxf,.dwg", [".dxf", ".dwg"]));
  registry.register(makeLoadCommand("LOAD_DXF", ".dxf", [".dxf"]));
  registry.register(makeLoadCommand("LOAD_DWG", ".dwg", [".dwg"]));
  registry.register({
    id: "SAVE_PROJECT",
    aliases: [],
    label: "Save Project",
    group: "file",
    icon: "save",
    tooltip: "Save .cadstruct.json",
    async run(ctx): Promise<void> {
      const adapter = ctx.adapter;
      if (!adapter) {
        ctx.prompter.log("Visor no disponible.");
        return;
      }
      ctx.prompter.log("Guardando proyecto...");
      const project = serializeProject(adapter.database);
      const name = await saveProjectFile(project, "drawing.cadstruct.json");
      if (!name) {
        ctx.prompter.log("*Cancel*");
        return;
      }
      // Guardar también en IndexedDB como proyecto reciente.
      const dxf = (project.settings.dxf as string) ?? "";
      const recent: RecentProject = {
        id: `${name}-${Date.now()}`,
        name,
        dxf,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      try {
        await saveRecentProject(recent);
      } catch {
        // IndexedDB puede fallar en algunos contextos; no es crítico.
      }
      ctx.prompter.log(`Proyecto guardado: ${name} (${(dxf.length / 1024).toFixed(1)} KB).`);
    },
  });
}
