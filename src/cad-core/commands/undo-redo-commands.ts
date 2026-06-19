import type { CadCommand } from "../command-types";
import { registry } from "../command-registry";

/**
 * Comandos UNDO / REDO (Paso 5).
 * Operan sobre el TransactionManager inyectado en el CadContext.
 * Toda modificación (draw/modify) pasa por el TransactionManager,
 * por lo que el undo/redo cubre todo el historial de cambios.
 */
export const undoCommand: CadCommand = {
  id: "UNDO",
  aliases: [],
  label: "Undo",
  group: "modify",
  icon: "undo",
  tooltip: "Undo",
  run(ctx): void {
    const tx = ctx.transactions;
    if (!tx) {
      ctx.prompter.log("Undo no disponible.");
      return;
    }
    if (!tx.canUndo()) {
      ctx.prompter.log("Nothing to undo.");
      return;
    }
    tx.undo();
    ctx.prompter.log("Undo.");
  },
};

export const redoCommand: CadCommand = {
  id: "REDO",
  aliases: [],
  label: "Redo",
  group: "modify",
  icon: "redo",
  tooltip: "Redo",
  run(ctx): void {
    const tx = ctx.transactions;
    if (!tx) {
      ctx.prompter.log("Redo no disponible.");
      return;
    }
    if (!tx.canRedo()) {
      ctx.prompter.log("Nothing to redo.");
      return;
    }
    tx.redo();
    ctx.prompter.log("Redo.");
  },
};

export function registerUndoRedoCommands(): void {
  registry.register(undoCommand);
  registry.register(redoCommand);
}
