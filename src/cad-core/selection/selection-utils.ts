import type { CadContext } from "../command-types";

/**
 * Utilidades de selección compartidas por todos los comandos.
 * Delegan en el adapter del visor (editor.getSelection) para no duplicar
 * la lógica de pick/window/crossing. Sincronizan el SelectionManager de
 * cad-core para que la UI y otros comandos reaccionen al cambio.
 *
 * Regla AGENTS.md: el OSNAP y la selección son compartidos por todos los
 * comandos, no se implementan snaps/selección separados por comando.
 */

export interface PickSelectionResult {
  ids: string[];
  cancelled: boolean;
}

/**
 * Pide al usuario una selección interactiva.
 * @param ctx contexto del comando (con adapter y selection manager).
 * @param singleOnly si true, permite un solo objeto.
 * @param promptMessage mensaje a mostrar en la línea de comando.
 */
export async function pickSelection(
  ctx: CadContext,
  singleOnly = false,
  promptMessage = "Select objects:",
): Promise<PickSelectionResult> {
  const adapter = ctx.selectionAdapter;
  if (!adapter) {
    ctx.prompter.log("Selección no disponible (visor no listo).");
    return { ids: [], cancelled: true };
  }
  ctx.prompter.prompt(promptMessage);
  const ids = await adapter.promptSelect(singleOnly);
  ctx.prompter.clearPrompt();
  if (ids === null) {
    ctx.prompter.log("*Cancel*");
    return { ids: [], cancelled: true };
  }
  if (ctx.selection) {
    ctx.selection.set(ids);
  }
  ctx.prompter.log(`${ids.length} objeto(s) seleccionado(s).`);
  return { ids, cancelled: false };
}
