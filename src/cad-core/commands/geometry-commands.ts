import type { CadCommand } from "../command-types";
import { registry } from "../command-registry";

/**
 * Comandos de geometría (Paso 8 - MVP2).
 * TRIM/EXTEND/FILLET/CHAMFER requieren cálculo de intersecciones y trimado
 * de curvas. Se registran como stubs con TODO explícito; su implementación
 * completa necesita:
 *   - Intersección curva-curva (AcGeLine2d intersect, AcGeCircArc2d).
 *   - Parametrización y sub-trimming de AcDbCurve.
 *   - Creación de arcos de fillet entre dos curvas.
 *
 * Regla AGENTS.md: "implementa la solución mínima razonable y deja TODOs".
 */

function stubGeometryCmd(id: string, aliases: string[], label: string, tooltip: string): CadCommand {
  return {
    id,
    aliases,
    label,
    group: "modify",
    icon: id.toLowerCase(),
    tooltip,
    run(ctx): void {
      ctx.prompter.prompt(`${id}: requiere geometría de intersección (TODO - no implementado en MVP2).`);
      ctx.prompter.log(`${id}: pendiente de implementación geométrica.`);
    },
  };
}

export function registerGeometryCommands(): void {
  registry.register(stubGeometryCmd("TRIM", ["TR"], "Trim", "Trim - Alias: TR"));
  registry.register(stubGeometryCmd("EXTEND", ["EX"], "Extend", "Extend - Alias: EX"));
  registry.register(stubGeometryCmd("FILLET", ["F"], "Fillet", "Fillet - Alias: F"));
  registry.register(stubGeometryCmd("CHAMFER", ["CHA"], "Chamfer", "Chamfer - Alias: CHA"));
}
