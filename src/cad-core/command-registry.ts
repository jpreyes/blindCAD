import type { CadCommand, CommandGroup } from "./command-types";

/**
 * Registro central de comandos.
 * Una sola fuente de verdad: botones, menús, shortcuts y línea de comando
 * consultan este registro vía CommandBus. Nunca duplicar lógica en la UI.
 */
class CommandRegistry {
  private commands = new Map<string, CadCommand>();
  private aliasIndex = new Map<string, string>();
  private listeners = new Set<() => void>();

  register(command: CadCommand): void {
    const id = command.id.toUpperCase();
    if (this.commands.has(id)) {
      console.warn(`[CommandRegistry] comando duplicado: ${id} (sobrescrito)`);
    }
    this.commands.set(id, { ...command, id });
    for (const alias of command.aliases ?? []) {
      this.aliasIndex.set(alias.toUpperCase(), id);
    }
    this.emit();
  }

  get(id: string): CadCommand | undefined {
    return this.commands.get(id.toUpperCase());
  }

  getByAlias(alias: string): CadCommand | undefined {
    const id = this.aliasIndex.get(alias.toUpperCase());
    return id ? this.commands.get(id) : undefined;
  }

  has(id: string): boolean {
    return this.commands.has(id.toUpperCase());
  }

  list(): CadCommand[] {
    return Array.from(this.commands.values());
  }

  listByGroup(group: CommandGroup): CadCommand[] {
    return this.list().filter((c) => c.group === group);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    listener();
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export const registry = new CommandRegistry();
