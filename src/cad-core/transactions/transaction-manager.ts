/**
 * Sistema de transacciones para undo/redo (esqueleto).
 * Toda modificación debe pasar por aquí; la UI nunca modifica entidades directamente.
 *
 * Uso futuro:
 *   transactionManager.run({
 *     name: "MOVE",
 *     do: () => moveEntities(ids, vector),
 *     undo: () => moveEntities(ids, inverseVector),
 *   });
 */
export interface Transaction {
  name: string;
  do: () => void;
  undo: () => void;
}

export class TransactionManager {
  private undoStack: Transaction[] = [];
  private redoStack: Transaction[] = [];

  run(tx: Transaction): void {
    tx.do();
    this.undoStack.push(tx);
    this.redoStack = [];
  }

  undo(): void {
    const tx = this.undoStack.pop();
    if (!tx) return;
    tx.undo();
    this.redoStack.push(tx);
  }

  redo(): void {
    const tx = this.redoStack.pop();
    if (!tx) return;
    tx.do();
    this.undoStack.push(tx);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
