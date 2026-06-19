# blindCAD

CAD 2D **estructural** web / PWA, **offline-first**, con línea de comandos tipo AutoCAD. Construido sobre `@mlightcad/cad-viewer` (visor DWG/DXF 100% en el navegador) y un núcleo de comandos framework-agnostic en TypeScript.

> Objetivo: una herramienta intermedia, práctica y productiva para producir planos estructurales — no un clon completo de AutoCAD. Ver [`AGENTS.md`](./AGENTS.md) para la especificación completa.

## Stack

- **Vite + Vue 3 + TypeScript** (UI)
- **`@mlightcad/cad-viewer`** (motor de visualización/carga DWG/DXF) — integración en paso 2
- **PWA** vía `vite-plugin-pwa` (service worker, manifest, offline-first)
- **Núcleo CAD en TS plano** (`src/cad-core`) desacoplado de la UI

## Cómo ejecutar

```bash
npm install
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # typecheck (vue-tsc) + build de producción
npm run typecheck  # solo verificación de tipos
npm run preview    # previsualizar build
```

> Requisitos: Node.js >= 24 (conforme a cad-viewer).

## Arquitectura

La lógica CAD está separada de la UI. Toda acción pasa por el `CommandBus`.

```
src/
  app/                  UI Vue (layout, toolbar, command-line, panels)
  cad-core/             Núcleo agnóstico (TS plano)
    commands/           sembrador de comandos MVP1 (stubs)
    command-registry.ts registro único de comandos
    command-bus.ts      ÚNICA entrada para ejecutar acciones
    aliases.ts          aliases tipo AutoCAD (L, C, TR, RO, ...)
    command-types.ts    tipos (CadCommand, CadContext, Prompter)
    geometry/           tipos geométricos mínimos
    transactions/       undo/redo (esqueleto)
    selection/          manager de selección (esqueleto)
    snaps/              OSNAP manager (esqueleto)
  cad-adapters/
    cad-viewer/         adapter del motor externo (interfaz + stub)
      cad-viewer-adapter.ts
      cad-viewer-selection-adapter.ts
      cad-viewer-render-adapter.ts
  structural/           herramientas rebar/steel (esqueleto, MVP4)
  storage/              persistencia / export (esqueleto)
  ui/components/        ToolbarButton.vue (lanza commandBus.run)
```

### Principio clave

Botones, menús, shortcuts y línea de comando llaman al **mismo** `CommandRegistry` vía `CommandBus`. No existe lógica duplicada entre la UI y la línea de comando.

```ts
commandBus.run("TRIM");              // botón Trim
commandBus.run("TRIM");              // menú Modify > Trim
commandBus.run(resolveAlias("TR"));  // línea de comando: TR
```

## Plan de implementación

Orden de prioridad técnica (de AGENTS.md):

1. CommandRegistry ✅
2. CommandBus ✅
3. Aliases ✅
4. Command line UI ✅
5. Toolbar icons usando CommandBus ✅
6. Selection manager (esqueleto) 🟡
7. OSNAP manager (esqueleto) 🟡
8. Basic draw commands (stubs) 🟡
9. Basic modify commands (stubs) 🟡
10. Undo/redo transactions (esqueleto) 🟡
11. Dimensions (pendiente)
12. Hatch (pendiente)
13. Blocks (pendiente)
14. Layouts/viewports (pendiente)
15. Export PDF/DXF (pendiente)
16. Structural tools (pendiente)

Leyenda: ✅ hecho · 🟡 esqueleto/interfaz · ⬜ pendiente

## Avances por MVP

Leyenda: ✅ hecho · 🟡 esqueleto · ⬜ pendiente

### Paso 1 — Scaffold + esqueletos + README (este commit)

- ✅ Vite + Vue 3 + TS + PWA (offline-first)
- ✅ Estructura de carpetas conforme a AGENTS.md
- ✅ `CommandRegistry` + `CommandBus` + `aliases` (todos los aliases de AGENTS.md)
- ✅ Línea de comando (historial, prompt, Enter repite último, ESC cancela, alias)
- ✅ Toolbar que lanza `commandBus.run` (sin lógica propia)
- ✅ `CadViewerAdapter` (interfaz + stub)
- 🟡 Selection / OSNAP / Transactions / Draw / Modify (esqueletos)
- ✅ README con arquitectura y tabla de avances

### MVP 1 — base usable ⬜

OPEN · SAVE_PROJECT · LOAD_DWG · LOAD_DXF · LINE · POLYLINE · RECTANGLE · CIRCLE ·
ERASE · MOVE · COPY · ROTATE · SCALE · ZOOM · PAN · SELECT · LAYER · UNDO · REDO ·
OSNAP_ENDPOINT · OSNAP_MIDPOINT · OSNAP_CENTER · OSNAP_INTERSECTION ·
DIMLINEAR · DIMALIGNED · DIMANGULAR

### MVP 2 — modificación y anotación ⬜

TRIM · EXTEND · OFFSET · EXPLODE · MIRROR · JOIN · BREAK · FILLET · CHAMFER ·
TEXT · MTEXT · HATCH_SOLID · HATCH_ANSI31 · WIPEOUT

### MVP 3 — planos reales ⬜

BLOCK · INSERT · EXPLODE_BLOCK · MULTILINE · LAYOUT · VIEWPORT · VIEWPORT_SCALE ·
VIEWPORT_LOCK · TITLE_BLOCK · PRINT_PDF · EXPORT_DXF

### MVP 4 — herramientas estructurales ⬜

REBAR · STIRRUP · REBARSET · REBARCALLOUT · REBARSCHEDULE · STEELPROFILE ·
PLATE · BOLTGROUP · WELD · SECTIONTAG · DETAILCALLOUT

## Persistencia (plan)

Estrategia sin depender de guardar DWG perfecto:

```
drawing.dwg
drawing.cadstruct.json   ← ediciones propias (sidecar)
drawing.pdf
drawing.dxf
```

- File System Access API cuando esté disponible, con fallback input/download.
- IndexedDB para proyectos recientes.
- Exportación PDF/DXF como respaldo.

## Próximo paso (Paso 2)

- Instalar `@mlightcad/cad-viewer` y montar el componente tras el `CadViewerAdapter`.
- Implementar `OPEN` / `LOAD_DXF` / `LOAD_DWG` mapeando al API del visor.
- Sustituir los stubs de draw/modify por máquinas de estado reales progresivamente.

## Licencia

Por definir. La librería `@mlightcad/cad-viewer` es MIT.
