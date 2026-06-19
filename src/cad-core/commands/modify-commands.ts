import { AcGeMatrix3d } from "@mlightcad/data-model";
import type { AcDbEntity, AcGeMatrix3d as MT3 } from "@mlightcad/data-model";
import type { CadCommand, CommandArgs, EntityId } from "../command-types";
import { registry } from "../command-registry";
import { pickSelection } from "@/cad-core/selection/selection-utils";
import { getPoint } from "@/cad-core/input/point-input";
import type { Transaction } from "@/cad-core/transactions/transaction-manager";

/**
 * Comandos de modificación (Paso 5) como máquinas de estado.
 * Flujo AutoCAD: selección → punto base → parámetro (vector/ángulo/factor).
 * Toda modificación pasa por el TransactionManager (undo/redo).
 *
 * Regla AGENTS.md: la UI solo llama a commandBus.run(ID). Sin lógica duplicada.
 */

interface Adapter {
  getEntityById(id: EntityId): AcDbEntity | undefined;
  transformEntity(id: EntityId, matrix: MT3): MT3;
  eraseEntity(id: EntityId): AcDbEntity | undefined;
  restoreEntity(entity: AcDbEntity): EntityId;
  cloneEntity(id: EntityId): EntityId | undefined;
}

function toAdapter(ctx: { adapter?: unknown }): Adapter | undefined {
  return ctx.adapter as Adapter | undefined;
}

/** Construye una transacción de transformación (do = aplicar, undo = inversa). */
function transformTx(ids: EntityId[], matrix: MT3, adapter: Adapter, name: string): Transaction {
  // Aplicar ahora y capturar inversas por entidad para undo preciso.
  const inverses = new Map<EntityId, MT3>();
  return {
    name,
    do: () => {
      inverses.clear();
      for (const id of ids) {
        const inv = adapter.transformEntity(id, matrix);
        inverses.set(id, inv);
      }
    },
    undo: () => {
      for (const [id, inv] of inverses) adapter.transformEntity(id, inv);
    },
  };
}

// --- ERASE ---
const eraseCommand: CadCommand = {
  id: "ERASE",
  aliases: ["E"],
  label: "Erase",
  group: "modify",
  icon: "erase",
  tooltip: "Erase - Alias: E",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = toAdapter(ctx);
    if (!adapter) {
      ctx.prompter.log("Visor no disponible.");
      return;
    }
    const sel = await pickSelection(ctx, false, "Select objects to erase:");
    if (sel.cancelled || sel.ids.length === 0) return;
    const tx = ctx.transactions;
    const snapshots = new Map<EntityId, AcDbEntity>();
    const doErase = () => {
      snapshots.clear();
      for (const id of sel.ids) {
        const snap = adapter.eraseEntity(id);
        if (snap) snapshots.set(id, snap);
      }
    };
    const undoErase = () => {
      for (const [, snap] of snapshots) adapter.restoreEntity(snap);
    };
    if (tx) {
      tx.run({ name: "ERASE", do: doErase, undo: undoErase });
    } else {
      doErase();
    }
    ctx.prompter.log(`${sel.ids.length} objeto(s) eliminado(s).`);
  },
};

// --- MOVE ---
const moveCommand: CadCommand = {
  id: "MOVE",
  aliases: ["M"],
  label: "Move",
  group: "modify",
  icon: "move",
  tooltip: "Move - Alias: M",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = toAdapter(ctx);
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const sel = await pickSelection(ctx, false, "Select objects to move:");
    if (sel.cancelled || sel.ids.length === 0) return;
    const base = await getPoint(ctx, "Specify base point:");
    if (base.cancelled) return ctx.prompter.log("*Cancel*");
    const dest = await getPoint(ctx, "Specify second point:", base.point);
    if (dest.cancelled) return ctx.prompter.log("*Cancel*");
    const dx = dest.point.x - base.point.x;
    const dy = dest.point.y - base.point.y;
    const matrix = new AcGeMatrix3d().makeTranslation(dx, dy, 0);
    const tx = ctx.transactions;
    if (tx) tx.run(transformTx(sel.ids, matrix, adapter, "MOVE"));
    else for (const id of sel.ids) adapter.transformEntity(id, matrix);
    ctx.prompter.log(`Move: dx=${dx.toFixed(2)} dy=${dy.toFixed(2)}`);
  },
};

// --- COPY ---
const copyCommand: CadCommand = {
  id: "COPY",
  aliases: ["CO", "CP"],
  label: "Copy",
  group: "modify",
  icon: "copy",
  tooltip: "Copy - Alias: CO/CP",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = toAdapter(ctx);
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const sel = await pickSelection(ctx, false, "Select objects to copy:");
    if (sel.cancelled || sel.ids.length === 0) return;
    const base = await getPoint(ctx, "Specify base point:");
    if (base.cancelled) return ctx.prompter.log("*Cancel*");
    const dest = await getPoint(ctx, "Specify second point:", base.point);
    if (dest.cancelled) return ctx.prompter.log("*Cancel*");
    const dx = dest.point.x - base.point.x;
    const dy = dest.point.y - base.point.y;
    const matrix = new AcGeMatrix3d().makeTranslation(dx, dy, 0);
    // Copiar: clonar cada entidad y transformar la copia.
    const newIds: EntityId[] = [];
    const tx = ctx.transactions;
    const doCopy = () => {
      newIds.length = 0;
      for (const id of sel.ids) {
        const newId = adapter.cloneEntity(id);
        if (newId) {
          adapter.transformEntity(newId, matrix);
          newIds.push(newId);
        }
      }
    };
    // Undo de copy = borrar las copias creadas.
    const undoCopy = () => {
      for (const id of newIds) adapter.eraseEntity(id);
    };
    if (tx) tx.run({ name: "COPY", do: doCopy, undo: undoCopy });
    else doCopy();
    ctx.prompter.log(`Copy: ${newIds.length} copia(s) creada(s).`);
  },
};

// --- ROTATE ---
const rotateCommand: CadCommand = {
  id: "ROTATE",
  aliases: ["RO"],
  label: "Rotate",
  group: "modify",
  icon: "rotate",
  tooltip: "Rotate - Alias: RO",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = toAdapter(ctx);
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const sel = await pickSelection(ctx, false, "Select objects to rotate:");
    if (sel.cancelled || sel.ids.length === 0) return;
    const base = await getPoint(ctx, "Specify base point:");
    if (base.cancelled) return ctx.prompter.log("*Cancel*");
    const anglePt = await getPoint(ctx, "Specify rotation angle:", base.point);
    if (anglePt.cancelled) return ctx.prompter.log("*Cancel*");
    const angle = Math.atan2(anglePt.point.y - base.point.y, anglePt.point.x - base.point.x);
    // Matriz: traslación al origen, rotación Z, traslación de vuelta.
    const m = new AcGeMatrix3d()
      .makeTranslation(-base.point.x, -base.point.y, 0)
      .multiply(new AcGeMatrix3d().makeRotationZ(angle))
      .multiply(new AcGeMatrix3d().makeTranslation(base.point.x, base.point.y, 0));
    const tx = ctx.transactions;
    if (tx) tx.run(transformTx(sel.ids, m, adapter, "ROTATE"));
    else for (const id of sel.ids) adapter.transformEntity(id, m);
    ctx.prompter.log(`Rotate: ${(angle * 180) / Math.PI}°`);
  },
};

// --- SCALE ---
const scaleCommand: CadCommand = {
  id: "SCALE",
  aliases: ["SC"],
  label: "Scale",
  group: "modify",
  icon: "scale",
  tooltip: "Scale - Alias: SC",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = toAdapter(ctx);
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const sel = await pickSelection(ctx, false, "Select objects to scale:");
    if (sel.cancelled || sel.ids.length === 0) return;
    const base = await getPoint(ctx, "Specify base point:");
    if (base.cancelled) return ctx.prompter.log("*Cancel*");
    const refPt = await getPoint(ctx, "Specify scale factor (pick point):", base.point);
    if (refPt.cancelled) return ctx.prompter.log("*Cancel*");
    const dist = Math.hypot(refPt.point.x - base.point.x, refPt.point.y - base.point.y);
    if (dist <= 0) return ctx.prompter.log("Factor no válido.");
    // Factor = distancia desde base al punto respecto a 1 unidad de referencia.
    const factor = dist; // simplificación: distancia como factor.
    const m = new AcGeMatrix3d()
      .makeTranslation(-base.point.x, -base.point.y, 0)
      .multiply(new AcGeMatrix3d().makeScale(factor, factor, 1))
      .multiply(new AcGeMatrix3d().makeTranslation(base.point.x, base.point.y, 0));
    const tx = ctx.transactions;
    if (tx) tx.run(transformTx(sel.ids, m, adapter, "SCALE"));
    else for (const id of sel.ids) adapter.transformEntity(id, m);
    ctx.prompter.log(`Scale: factor=${factor.toFixed(2)}`);
  },
};

export function registerModifyCommands(): void {
  registry.register(eraseCommand);
  registry.register(moveCommand);
  registry.register(copyCommand);
  registry.register(rotateCommand);
  registry.register(scaleCommand);
}
