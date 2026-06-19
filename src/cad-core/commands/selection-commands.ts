import type { CadCommand } from "../command-types";
import { registry } from "../command-registry";
import { pickSelection } from "@/cad-core/selection/selection-utils";

/**
 * Comando SELECT (Paso 3).
 * Pide selección interactiva delegando en el adapter del visor y
 * sincroniza el SelectionManager de cad-core. La UI (panel de propiedades)
 * reacciona vía suscripción al SelectionManager.
 *
 * Regla AGENTS.md: la UI solo llama a commandBus.run("SELECT").
 */
export const selectCommand: CadCommand = {
  id: "SELECT",
  aliases: [],
  label: "Select",
  group: "modify",
  icon: "select",
  tooltip: "Select objects",
  async run(ctx): Promise<void> {
    await pickSelection(ctx, false, "Select objects:");
  },
};

export function registerSelectionCommands(): void {
  registry.register(selectCommand);
}
