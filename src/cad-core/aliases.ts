/**
 * Tabla de aliases tipo AutoCAD.
 * Resuelve un input corto (p.ej. "TR") al ID de comando ("TRIM").
 * Cualquier UI (botón, menú, línea de comando) debe llamar a CommandBus,
 * que a su vez usa resolveAlias().
 *
 * Aliases tomados de AGENTS.md.
 */

const ALIASES: Record<string, string> = {
  // Draw
  L: "LINE",
  PL: "POLYLINE",
  REC: "RECTANGLE",
  C: "CIRCLE",
  A: "ARC",
  T: "TEXT",
  MT: "MTEXT",
  ML: "MULTILINE",

  // Modify
  M: "MOVE",
  CO: "COPY",
  CP: "COPY",
  RO: "ROTATE",
  SC: "SCALE",
  TR: "TRIM",
  EX: "EXTEND",
  O: "OFFSET",
  X: "EXPLODE",
  E: "ERASE",
  MI: "MIRROR",
  F: "FILLET",
  CHA: "CHAMFER",
  BR: "BREAK",
  J: "JOIN",
  ST: "STRETCH",

  // Annotation
  DIM: "DIMENSION",
  DLI: "DIMLINEAR",
  DAL: "DIMALIGNED",
  DAN: "DIMANGULAR",
  DRA: "DIMRADIUS",
  DDI: "DIMDIAMETER",
  DCO: "DIMCONTINUE",
  DBA: "DIMBASELINE",
  LE: "LEADER",
  H: "HATCH",

  // Layers / properties
  LA: "LAYER",
  MA: "MATCHPROP",
  PR: "PROPERTIES",

  // Blocks
  B: "BLOCK",
  I: "INSERT",
  BE: "BLOCKEDIT",

  // View / layout
  Z: "ZOOM",
  P: "PAN",
  RE: "REGEN",
  MS: "MODELSPACE",
  PS: "PAPERSPACE",
  MV: "MVIEW",

  // Structural
  RBAR: "REBAR",
  RSTIR: "STIRRUP",
  RSET: "REBARSET",
  RCALL: "REBARCALLOUT",
  RTABLE: "REBARSCHEDULE",
  SPROF: "STEELPROFILE",
  PLATE: "PLATE",
  BOLT: "BOLTGROUP",
  WELD: "WELD",
  SECT: "SECTIONTAG",
};

/** Resuelve un alias (case-insensitive) al ID de comando, o undefined. */
export function resolveAlias(input: string): string | undefined {
  const key = input.trim().toUpperCase();
  if (!key) return undefined;
  if (ALIASES[key]) return ALIASES[key];
  return undefined;
}

/** Lista todos los aliases conocidos (para ayuda/autocompletado futuro). */
export function listAliases(): { alias: string; commandId: string }[] {
  return Object.entries(ALIASES).map(([alias, commandId]) => ({ alias, commandId }));
}
