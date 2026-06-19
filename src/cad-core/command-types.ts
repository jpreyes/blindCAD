/**
 * Tipos centrales del sistema de comandos.
 * Framework-agnostic (TS plano). La UI (Vue) solo consume/lanza comandos.
 */

export type EntityId = string;

export interface Point {
  x: number;
  y: number;
  z?: number;
}

export type CommandGroup =
  | "file"
  | "draw"
  | "modify"
  | "annotate"
  | "layers"
  | "blocks"
  | "layout"
  | "view"
  | "structural"
  | "snaps";

export type CommandArgs = Record<string, unknown> & {
  mode?: string;
};

/**
 * Contexto que recibe cada comando al ejecutarse.
 * Los campos son opcionales porque el scaffold aún no cablea todos los servicios.
 * Los comandos deben hacer guardas (?.) hasta que cada servicio exista.
 */
export interface CadContext {
  adapter?: import("@/cad-adapters/cad-viewer/cad-viewer-adapter").CadViewerAdapter;
  selectionAdapter?: import("@/cad-adapters/cad-viewer/cad-viewer-selection-adapter").CadViewerSelectionAdapter;
  selection?: import("@/cad-core/selection/selection-manager").SelectionManager;
  osnap?: import("@/cad-core/snaps/osnap-manager").OsnapManager;
  transactions?: import("@/cad-core/transactions/transaction-manager").TransactionManager;
  prompter: Prompter;
}

/**
 * Interacción con la línea de comando (prompts, entradas, opciones).
 * Implementado por el CommandBus y consumido por los comandos interactivos.
 */
export interface Prompter {
  /** Muestra texto en el historial de la línea de comando. */
  log(message: string): void;
  /** Establece el prompt activo que el usuario ve junto al input. */
  prompt(message: string, options?: string[]): void;
  /** Limpia el prompt activo. */
  clearPrompt(): void;
}

/**
 * Estado de un comando multi-paso en curso.
 */
export interface ActiveCommand {
  id: string;
  step: number;
  args: CommandArgs;
}

export interface CadCommand {
  id: string;
  aliases: string[];
  label: string;
  description?: string;
  icon?: string;
  group: CommandGroup;
  tooltip?: string;
  run: (ctx: CadContext, args?: CommandArgs) => Promise<void> | void;
}
