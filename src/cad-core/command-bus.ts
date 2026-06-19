import type {
  ActiveCommand,
  CadCommand,
  CadContext,
  CommandArgs,
  Prompter,
} from "./command-types";
import type { CadViewerAdapter } from "@/cad-adapters/cad-viewer/cad-viewer-adapter";
import { resolveAlias } from "./aliases";
import { registry } from "./command-registry";

export interface CommandBusState {
  active: ActiveCommand | null;
  prompt: { message: string; options?: string[] } | null;
  history: string[];
}

type Listener = (state: CommandBusState) => void;

/**
 * Única entrada para ejecutar acciones CAD.
 * Botones, menús, shortcuts y línea de comando llaman a run().
 * No debe existir lógica duplicada entre la UI y la línea de comando.
 */
class CommandBus implements Prompter {
  private state: CommandBusState = {
    active: null,
    prompt: null,
    history: [],
  };
  private listeners = new Set<Listener>();
  private lastCommandId: string | null = null;
  private adapter?: CadViewerAdapter;

  /** Inyecta el adapter del visor (lo cablea el componente CadViewer). */
  setAdapter(adapter: CadViewerAdapter): void {
    this.adapter = adapter;
  }

  // --- Prompter API (usada por los comandos) ---
  log(message: string): void {
    this.state = { ...this.state, history: [...this.state.history, message] };
    this.emit();
  }

  prompt(message: string, options?: string[]): void {
    this.state = { ...this.state, prompt: { message, options } };
    this.emit();
  }

  clearPrompt(): void {
    this.state = { ...this.state, prompt: null };
    this.emit();
  }

  // --- Suscripción para la UI (línea de comando) ---
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): CommandBusState {
    return this.state;
  }

  // --- Ejecución ---
  /** Ejecuta por ID o alias. Devuelve true si se ejecutó. */
  async run(idOrAlias: string, args?: CommandArgs): Promise<boolean> {
    const command = this.resolve(idOrAlias);
    if (!command) {
      this.log(`Comando desconocido: "${idOrAlias}"`);
      return false;
    }
    this.log(`Command: ${command.id}`);
    this.lastCommandId = command.id;
    this.state = {
      ...this.state,
      active: { id: command.id, step: 0, args: args ?? {} },
    };
    this.emit();
    const ctx: CadContext = { prompter: this, adapter: this.adapter };
    try {
      await command.run(ctx, args ?? {});
    } catch (err) {
      this.log(`Error en ${command.id}: ${String(err)}`);
    } finally {
      this.endCommand();
    }
    return true;
  }

  /** Repite el último comando (Enter/Space en línea de comando). */
  async runLast(): Promise<boolean> {
    if (!this.lastCommandId) {
      this.log("No hay comando anterior para repetir.");
      return false;
    }
    return this.run(this.lastCommandId);
  }

  /** Cancela el comando activo (ESC). */
  cancel(): void {
    if (this.state.active) {
      this.log(`*Cancel*`);
    }
    this.endCommand();
  }

  /** Resuelve ID o alias a un CadCommand. */
  private resolve(idOrAlias: string): CadCommand | undefined {
    const upper = idOrAlias.trim().toUpperCase();
    return registry.get(upper) ?? registry.getByAlias(upper) ?? registry.get(resolveAlias(idOrAlias) ?? "");
  }

  private endCommand(): void {
    this.state = { ...this.state, active: null, prompt: null };
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l(this.state);
  }
}

export const commandBus = new CommandBus();
