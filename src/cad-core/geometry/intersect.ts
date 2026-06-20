/**
 * Utilidades geométricas 2D para TRIM/EXTEND/FILLET/CHAMFER.
 *
 * Se implementan las operaciones mínimas con cálculo manual de intersecciones
 * de segmentos de línea. Soporta AcDbLine (dos segmentos). Para curvas
 * complejas (arcos/círculos/polylines con bulge) se deja TODO.
 *
 * Principio AGENTS.md: "implementa la solución mínima razonable y deja TODOs".
 */

export interface Pt2 {
  x: number;
  y: number;
}

/** Intersección de dos segmentos de línea (p1->p2) y (p3->p4). */
export function lineLineIntersect(p1: Pt2, p2: Pt2, p3: Pt2, p4: Pt2): Pt2 | null {
  const x1 = p1.x;
  const y1 = p1.y;
  const x2 = p2.x;
  const y2 = p2.y;
  const x3 = p3.x;
  const y3 = p3.y;
  const x4 = p4.x;
  const y4 = p4.y;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-9) return null; // paralelas o colineales
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  // Para intersección de segmentos finitos, t y u en [0,1].
  // Para EXTEND permitimos t/u fuera de rango (intersección de líneas infinitas).
  const x = x1 + t * (x2 - x1);
  const y = y1 + t * (y2 - y1);
  void u;
  return { x, y };
}

/** Intersección de segmentos finitos (t,u en [0,1]); null si no se cruzan. */
export function segmentIntersect(p1: Pt2, p2: Pt2, p3: Pt2, p4: Pt2): Pt2 | null {
  const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}

/** Distancia entre dos puntos. */
export function dist(a: Pt2, b: Pt2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Punto medio. */
export function mid(a: Pt2, b: Pt2): Pt2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Calcula el centro y puntos de tangencia para un fillet (arco tangente a dos
 * segmentos que se intersecan). Devuelve el arco como {center, p1, p2, r} o null.
 */
export function filletArc(
  line1Start: Pt2,
  line1End: Pt2,
  line2Start: Pt2,
  line2End: Pt2,
  radius: number,
): { center: Pt2; p1: Pt2; p2: Pt2; r: number } | null {
  const intersection = lineLineIntersect(line1Start, line1End, line2Start, line2End);
  if (!intersection) return null;
  // Vectores unitarios desde la intersección hacia los extremos.
  const dir1 = norm(sub(line1End, line1Start));
  const dir2 = norm(sub(line2End, line2Start));
  // Bisectriz.
  const bisect = norm({ x: dir1.x + dir2.x, y: dir1.y + dir2.y });
  // El centro del arco está en la bisectriz a distancia r/sin(θ/2).
  const angle = Math.acos(Math.max(-1, Math.min(1, dir1.x * dir2.x + dir1.y * dir2.y)));
  const half = angle / 2;
  if (Math.abs(Math.sin(half)) < 1e-9) return null;
  const centerDist = radius / Math.sin(half);
  const center = { x: intersection.x + bisect.x * centerDist, y: intersection.y + bisect.y * centerDist };
  // Puntos de tangencia: proyección del centro sobre cada línea.
  const p1 = projectOnLine(center, line1Start, line1End);
  const p2 = projectOnLine(center, line2Start, line2End);
  return { center, p1, p2, r: radius };
}

function norm(v: Pt2): Pt2 {
  const l = Math.hypot(v.x, v.y);
  if (l < 1e-9) return { x: 0, y: 0 };
  return { x: v.x / l, y: v.y / l };
}

function sub(a: Pt2, b: Pt2): Pt2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function projectOnLine(p: Pt2, a: Pt2, b: Pt2): Pt2 {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const t = (ap.x * ab.x + ap.y * ab.y) / (ab.x * ab.x + ab.y * ab.y);
  return { x: a.x + t * ab.x, y: a.y + t * ab.y };
}
