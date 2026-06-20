import {
  AcDbBlockReference,
  AcGePoint3d,
  type AcDbEntity,
} from "@mlightcad/data-model";
import type { CadCommand, CommandArgs, EntityId, Point } from "../command-types";
import { registry } from "../command-registry";
import { getPoint } from "@/cad-core/input/point-input";
import { pickSelection } from "@/cad-core/selection/selection-utils";

/**
 * Comandos de bloques (Paso 9 - MVP3).
 * BLOCK: crea una definición de bloque desde entidades seleccionadas.
 * INSERT: inserta una referencia de bloque.
 * EXPLODE_BLOCK: descompone una referencia de bloque en sus entidades.
 *
 * Regla AGENTS.md: la UI solo llama a commandBus.run(ID).
 */

function p3(p: Point): AcGePoint3d {
  return new AcGePoint3d(p.x, p.y, p.z ?? 0);
}

async function promptString(
  ctx: Parameters<CadCommand["run"]>[0],
  message: string,
): Promise<string | null> {
  const editor = ctx.adapter?.editor;
  if (!editor) return null;
  const { AcEdPromptStringOptions, AcEdPromptStatus } = await import("@mlightcad/cad-simple-viewer");
  const opts = new AcEdPromptStringOptions(message);
  ctx.prompter.prompt(message);
  const res = await editor.getString(opts);
  ctx.prompter.clearPrompt();
  if (res.status !== AcEdPromptStatus.OK) return null;
  return res.stringResult ?? null;
}

// --- BLOCK ---
const blockCommand: CadCommand = {
  id: "BLOCK",
  aliases: ["B"],
  label: "Block",
  group: "blocks",
  icon: "block",
  tooltip: "Create block - Alias: B",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const name = await promptString(ctx, "Enter block name:");
    if (!name) return ctx.prompter.log("*Cancel*");
    const base = await getPoint(ctx, "Specify insertion base point:");
    if (base.cancelled) return ctx.prompter.log("*Cancel*");
    const sel = await pickSelection(ctx, false, "Select objects for block:");
    if (sel.cancelled || sel.ids.length === 0) return;
    // Recoger las entidades seleccionadas (clonadas, para moverlas al block).
    const entities: AcDbEntity[] = [];
    for (const id of sel.ids) {
      const e = adapter.getEntityById(id);
      if (e) entities.push(e.clone());
    }
    adapter.createBlock(name, base.point, entities);
    // Borrar las entidades originales (ahora están en el block).
    const tx = ctx.transactions;
    const doBlock = () => {
      for (const id of sel.ids) adapter.eraseEntity(id);
    };
    const undoBlock = () => {
      // TODO(undo-block): restaurar entidades originales + borrar block def.
      ctx.prompter.log("(undo de BLOCK limitado en esta versión)");
    };
    if (tx) tx.run({ name: "BLOCK", do: doBlock, undo: undoBlock });
    else doBlock();
    ctx.prompter.log(`Block "${name}" creado con ${entities.length} entidades.`);
  },
};

// --- INSERT ---
const insertCommand: CadCommand = {
  id: "INSERT",
  aliases: ["I"],
  label: "Insert",
  group: "blocks",
  icon: "insert",
  tooltip: "Insert block - Alias: I",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const name = await promptString(ctx, "Enter block name to insert:");
    if (!name) return ctx.prompter.log("*Cancel*");
    if (!adapter.hasBlock(name)) {
      ctx.prompter.log(`Bloque "${name}" no encontrado. Bloques: ${adapter.listBlocks().join(", ") || "(ninguno)"}`);
      return;
    }
    const pos = await getPoint(ctx, "Specify insertion point:");
    if (pos.cancelled) return ctx.prompter.log("*Cancel*");
    const ref = new AcDbBlockReference(name);
    ref.position = p3(pos.point);
    // Undo = erase de la referencia.
    let id: EntityId | undefined;
    const tx = ctx.transactions;
    const doInsert = () => {
      id = adapter.addNativeEntity(ref);
    };
    const undoInsert = () => {
      if (id !== undefined) adapter.eraseEntity(id);
    };
    if (tx) tx.run({ name: "INSERT", do: doInsert, undo: undoInsert });
    else doInsert();
    ctx.prompter.log(`Insert "${name}" en (${pos.point.x},${pos.point.y}).`);
  },
};

// --- EXPLODE_BLOCK ---
const explodeBlockCommand: CadCommand = {
  id: "EXPLODE_BLOCK",
  aliases: [],
  label: "Explode Block",
  group: "blocks",
  icon: "explode-block",
  tooltip: "Explode block reference",
  async run(ctx, _args?: CommandArgs): Promise<void> {
    const adapter = ctx.adapter;
    if (!adapter) return ctx.prompter.log("Visor no disponible.");
    const sel = await pickSelection(ctx, true, "Select block reference to explode:");
    if (sel.cancelled || sel.ids.length === 0) return;
    const entity = adapter.getEntityById(sel.ids[0]);
    if (!entity) return ctx.prompter.log("Entidad no encontrada.");
    if (!(entity instanceof AcDbBlockReference)) {
      ctx.prompter.log("EXPLODE_BLOCK: selecciona una referencia de bloque (INSERT).");
      return;
    }
    const ref = entity;
    const btr = ref.blockTableRecord;
    if (!btr) {
      ctx.prompter.log("Definición de bloque no encontrada.");
      return;
    }
    // Iterar las entidades del block y crear copias transformadas por blockTransform.
    const matrix = ref.blockTransform;
    const newEntities: AcDbEntity[] = [];
    const it = btr.newIterator();
    for (const e of it) {
      const copy = e.clone();
      copy.transformBy(matrix);
      newEntities.push(copy);
    }
    const tx = ctx.transactions;
    const newIds: EntityId[] = [];
    const snap = ref.clone();
    const doExplode = () => {
      newIds.length = 0;
      adapter.eraseEntity(sel.ids[0]);
      for (const e of newEntities) newIds.push(adapter.addNativeEntity(e));
    };
    const undoExplode = () => {
      for (const id of newIds) adapter.eraseEntity(id);
      adapter.restoreEntity(snap);
    };
    if (tx) tx.run({ name: "EXPLODE_BLOCK", do: doExplode, undo: undoExplode });
    else doExplode();
    ctx.prompter.log(`Explode block: ${newEntities.length} entidades.`);
  },
};

export function registerBlockCommands(): void {
  registry.register(blockCommand);
  registry.register(insertCommand);
  registry.register(explodeBlockCommand);
}
