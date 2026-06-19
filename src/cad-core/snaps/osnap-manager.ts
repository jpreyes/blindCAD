/**
 * OSNAP manager (esqueleto).
 * MVP mínimo: Endpoint, Midpoint, Center, Intersection, Nearest.
 * Compartido por todos los comandos (no snaps separados por comando).
 */
export type OsnapKind =
  | "endpoint"
  | "midpoint"
  | "center"
  | "intersection"
  | "nearest";

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

  isEnabled(kind: OsnapKind): boolean {
    return this.enabled.has(kind);
  }

  enable(kind: OsnapKind): void {
    this.enabled.add(kind);
  }

  disable(kind: OsnapKind): void {
    this.enabled.delete(kind);
  }

  toggle(kind: OsnapKind): void {
    if (this.enabled.has(kind)) this.enabled.delete(kind);
    else this.enabled.add(kind);
  }

  /**
   * Solicita un snap cerca de un punto candidato.
   * TODO: implementar búsqueda real contra entidades del adapter.
   */
  snap(_near: { x: number; y: number }): OsnapResult | null {
    return null;
  }
}
