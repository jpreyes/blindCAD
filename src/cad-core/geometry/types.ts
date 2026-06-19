/**
 * Tipos geométricos mínimos compartidos.
 * Se ampliará conforme se implementen entidades y operaciones.
 */
import type { EntityId, Point } from "../command-types";
export type { EntityId, Point };

export interface Bounds {
  min: Point;
  max: Point;
}

export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
