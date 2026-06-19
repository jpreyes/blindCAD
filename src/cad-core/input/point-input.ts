import { AcEdPromptPointOptions, AcEdPromptStatus } from "@mlightcad/cad-simple-viewer";
import { AcGePoint3d, type AcGePoint3dLike } from "@mlightcad/data-model";
import type { CadContext, Point } from "../command-types";

/**
 * Utilidades de entrada de puntos para comandos draw/modify.
 * Envuelven editor.getPoint del visor (con OSNAP activo) y traducen
 * el resultado al tipo Point de cad-core. Manejan cancelación (ESC).
 *
 * Regla AGENTS.md: el OSNAP es compartido; aquí solo se consume el punto
 * ya "snappeado" por el visor.
 */

export interface PointInputResult {
  point: Point;
  cancelled: boolean;
}

/**
 * Pide un punto al usuario con un prompt.
 * @param ctx contexto del comando (con adapter).
 * @param message mensaje del prompt.
 * @param basePoint punto base opcional (línea elástica).
 */
export async function getPoint(
  ctx: CadContext,
  message: string,
  basePoint?: Point,
): Promise<PointInputResult> {
  const editor = ctx.adapter?.editor;
  if (!editor) {
    ctx.prompter.log("Editor no disponible (visor no listo).");
    return { point: { x: 0, y: 0 }, cancelled: true };
  }
  const opts = new AcEdPromptPointOptions(message);
  if (basePoint) {
    opts.useBasePoint = true;
    opts.basePoint = new AcGePoint3d(basePoint.x, basePoint.y, basePoint.z ?? 0);
  }
  ctx.prompter.prompt(message);
  const res = await editor.getPoint(opts);
  ctx.prompter.clearPrompt();
  if (res.status !== AcEdPromptStatus.OK || !res.value) {
    return { point: { x: 0, y: 0 }, cancelled: true };
  }
  const v = res.value as AcGePoint3dLike;
  return { point: { x: v.x, y: v.y, z: v.z }, cancelled: false };
}
