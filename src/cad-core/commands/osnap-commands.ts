import type { CadCommand } from "../command-types";
import { registry } from "../command-registry";
import type { OsnapKind } from "@/cad-core/snaps/osnap-manager";

/**
 * Comandos OSNAP_* (Paso 3).
 * Cada uno togglea un modo de snap en el OsnapManager, que a su vez
 * sincroniza la máscara bitmask con AcApSettingManager.osnapModes del visor.
 * El OSNAP es compartido por todos los comandos (no snaps por comando).
 */
function makeOsnapToggle(id: string, kind: OsnapKind, label: string): CadCommand {
  return {
    id,
    aliases: [],
    label,
    group: "snaps",
    icon: `osnap-${kind}`,
    tooltip: `${label} (toggle)`,
    run(ctx): void {
      const osnap = ctx.osnap;
      if (!osnap) {
        ctx.prompter.log("OSNAP no disponible (visor no listo).");
        return;
      }
      osnap.toggle(kind);
      const state = osnap.isEnabled(kind) ? "ON" : "OFF";
      ctx.prompter.log(`${label}: ${state}`);
    },
  };
}

export function registerOsnapCommands(): void {
  registry.register(makeOsnapToggle("OSNAP_ENDPOINT", "endpoint", "Osnap Endpoint"));
  registry.register(makeOsnapToggle("OSNAP_MIDPOINT", "midpoint", "Osnap Midpoint"));
  registry.register(makeOsnapToggle("OSNAP_CENTER", "center", "Osnap Center"));
  registry.register(makeOsnapToggle("OSNAP_INTERSECTION", "intersection", "Osnap Intersection"));
  registry.register(makeOsnapToggle("OSNAP_NEAREST", "nearest", "Osnap Nearest"));
}
