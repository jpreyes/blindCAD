/**
 * OSNAP manager (framework-agnostic).
 * MVP mínimo: Endpoint, Midpoint, Center, Intersection, Nearest.
 * Compartido por todos los comandos (no snaps separados por comando).
 *
 * En el Paso 3 se sincroniza con AcApSettingManager.osnapModes del visor
 * (bitmask de AcDbOsnapMode) vía el adapter, sin duplicar la lógica de snap.
 */
export type OsnapKind =
  | "endpoint"
  | "midpoint"
  | "center"
  | "intersection"
  | "nearest";

/** Modo numérico de AcDbOsnapMode (@mlightcad/data-model). */
export const OSNAP_KIND_TO_MODE: Record<OsnapKind, number> = {
  endpoint: 1, // AcDbOsnapMode.EndPoint
  midpoint: 2, // AcDbOsnapMode.MidPoint
  center: 3, // AcDbOsnapMode.Center
  // AcDbOsnapMode no define Intersection como enum value directa en 1.8.4;
  // se maneja vía el motor del visor. Se reserva 6 (valor AutoCAD Inters).
  intersection: 6,
  nearest: 10, // AcDbOsnapMode.Nearest
};

export interface OsnapResult {
  kind: OsnapKind;
  point: { x: number; y: number; z?: number };
  entityId?: string;
}

export class OsnapManager {
  private enabled = new Set<OsnapKind>([
    "endpoint",
    "midpoint",
    "center",
    "intersection",
    "nearest",
  ]);

  /** Callback para sincronizar la máscara con el visor (lo cablea el adapter). */
  private sync?: (mask: number) => void;

  /** Registra el sincronizador del visor. */
  bindSync(syncFn: (mask: number) => void): void {
    this.sync = syncFn;
    this.sync(this.toMask());
  }

  isEnabled(kind: OsnapKind): boolean {
    return this.enabled.has(kind);
  }

  enable(kind: OsnapKind): void {
    this.enabled.add(kind);
    this.sync?.(this.toMask());
  }

  disable(kind: OsnapKind): void {
    this.enabled.delete(kind);
    this.sync?.(this.toMask());
  }

  toggle(kind: OsnapKind): void {
    if (this.enabled.has(kind)) this.enabled.delete(kind);
    else this.enabled.add(kind);
    this.sync?.(this.toMask());
  }

  /** Convierte los kinds habilitados a una máscara bitmask del visor. */
  private toMask(): number {
    let mask = 0;
    for (const kind of this.enabled) {
      mask |= 1 << OSNAP_KIND_TO_MODE[kind];
    }
    return mask;
  }

  /**
   * Solicita un snap cerca de un punto candidato.
   * El visor aplica osnap automáticamente durante editor.getPoint; este
   * método se mantiene para consultas puntuales futuras (p.ej. mostrar
   * un marker). Por ahora retorna null (el snap real ocurre en el visor).
   */
  snap(_near: { x: number; y: number }): OsnapResult | null {
    return null;
  }
}
