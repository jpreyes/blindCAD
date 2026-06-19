/**
 * Manager de selección (esqueleto).
 * MVP mínimo: click select, shift add/remove, window select, delete selected.
 * La UI no debe modificar entidades directamente: opera vía comandos/transacciones.
 */
export interface SelectionChangeEvent {
  ids: Set<string>;
}

export class SelectionManager {
  private ids = new Set<string>();
  private listeners = new Set<(e: SelectionChangeEvent) => void>();

  get selected(): Set<string> {
    return new Set(this.ids);
  }

  set(ids: Iterable<string>): void {
    this.ids = new Set(ids);
    this.emit();
  }

  add(id: string): void {
    this.ids.add(id);
    this.emit();
  }

  remove(id: string): void {
    this.ids.delete(id);
    this.emit();
  }

  toggle(id: string): void {
    if (this.ids.has(id)) this.ids.delete(id);
    else this.ids.add(id);
    this.emit();
  }

  clear(): void {
    this.ids.clear();
    this.emit();
  }

  subscribe(listener: (e: SelectionChangeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const e: SelectionChangeEvent = { ids: new Set(this.ids) };
    for (const l of this.listeners) l(e);
  }
}

/** Singleton compartido por comandos y UI. */
export const selectionManager = new SelectionManager();
