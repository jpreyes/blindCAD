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
    commands/           seed-commands.ts (stubs MVP1) · file-commands.ts (OPEN/LOAD)
  cad-adapters/
    cad-viewer/         adapter del motor externo
      cad-viewer-adapter.ts              interfaz (+ stub)
      cad-viewer-adapter-impl.ts         impl real envolviendo AcApDocManager
      cad-viewer-selection-adapter.ts    interfaz selección
      cad-viewer-selection-adapter-impl.ts  impl real (pick/window/promptSelect)
      cad-viewer-render-adapter.ts
  app/panels/CadViewer.vue   monta MlCadViewer con UI oculta
  app/panels/PropertiesPanel.vue  conteo de selección
  structural/           herramientas rebar/steel (esqueleto, MVP4)
  storage/              persistencia / export · file-dialog.ts (apertura de archivos)
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
6. Selection manager ✅
7. OSNAP manager ✅
8. Basic draw commands ✅
9. Basic modify commands ✅
10. Undo/redo transactions ✅
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

### Paso 2 — Integración de cad-viewer + apertura de archivos

- ✅ `@mlightcad/cad-viewer` (componente `MlCadViewer`) montado como motor de visualización/carga
- ✅ UI propia del visor oculta (`AcApSettingManager`): toolbar, command line, main menu, etc.
- ✅ `CadViewerAdapterImpl` real envolviendo `AcApDocManager` (`openDocument`/`openUrl`/`zoomExtents`/`regen`/...)
- ✅ Adapter inyectado en el `CommandBus` (`setAdapter`) al iniciar el visor — `cad-core` sigue agnóstico
- ✅ Comandos `OPEN` / `LOAD_DXF` / `LOAD_DWG` funcionales (diálogo de archivo → `adapter.loadFile`)
- ✅ Diálogo de archivos con File System Access API + fallback `<input>` (`storage/file-dialog.ts`)
- ✅ Web Workers del parser DWG/DXF y renderer MTEXT copiados a `assets/` (`vite-plugin-static-copy`)
- ✅ PWA precachea los workers (offline-first para parseo DWG)
- ✅ CSS de element-plus + cad-viewer cargados; `i18n` registrado
- 🟡 `SAVE_PROJECT` (stub, paso de persistencia)
- 🟡 Entidades (getEntities/addEntity/...) — se cablean en draw/modify

> Nota de dependencias: `@mlightcad/data-model` está pinneado a `1.8.4` porque las
> versiones `1.9.x` eliminaron `AcDbDxfConverter`, que `cad-simple-viewer@1.5.5` importa.

### Paso 3 — Selection + OSNAP

- ✅ `CadViewerSelectionAdapterImpl` real: `pickAt`/`windowSelect`/`highlight`/`clearHighlight` + `promptSelect` (delega en `editor.getSelection` del visor)
- ✅ `SelectionManager` (cad-core) con singleton compartido, inyectado en el `CommandBus`
- ✅ Comando `SELECT` funcional (selección interactiva → sincroniza `SelectionManager`)
- ✅ `selection-utils.ts`: `pickSelection()` reutilizable por todos los comandos modify
- ✅ `OsnapManager` ampliado: mapea kinds a `AcDbOsnapMode` y sincroniza máscara bitmask con `AcApSettingManager.osnapModes` del visor
- ✅ Comandos `OSNAP_ENDPOINT` / `OSNAP_MIDPOINT` / `OSNAP_CENTER` / `OSNAP_INTERSECTION` / `OSNAP_NEAREST` (toggle)
- ✅ Toolbar con grupo `snaps` (botones OSNAP que lanzan `commandBus.run`)
- ✅ Panel Properties muestra el conteo de selección (suscripción al `SelectionManager`)
- ✅ `CadContext` ampliado con `selectionAdapter` / `selection` / `osnap`

> El visor ya implementa click/window/crossing y osnap internamente; nuestros
> managers se **sincronizan** con él vía adapters, sin duplicar la lógica de pick.

### Paso 4 — Draw (LINE, POLYLINE, RECTANGLE, CIRCLE)

- ✅ Máquinas de estado `LINE` / `CIRCLE` / `RECTANGLE` / `POLYLINE` vía `CommandBus`
- ✅ Entrada interactiva de puntos con `editor.getPoint` del visor (OSNAP activo)
- ✅ `point-input.ts`: util `getPoint()` reutilizable (maneja base point, cancelación ESC)
- ✅ `adapter.addNativeEntity(AcDbEntity)`: appenda a `database.tables.blockTable.modelSpace` + `view.addEntity`
- ✅ Entidades nativas `@mlightcad/data-model`: `AcDbLine`, `AcDbCircle`, `AcDbPolyline` (rectángulo = polilínea cerrada)
- ✅ Adapter ampliado con `editor` y `database` (lectores), `removeNativeEntity`
- ✅ Comandos draw quitados del seed-commands (ahora son reales)

> LINE pide primer punto y sigue con "next point" hasta ESC. POLYLINE acumula
> vértices hasta ESC (inserta al cancelar). CIRCLE pide centro + punto de radio.
> RECTANGLE pide dos esquinas opuestas.

### Paso 5 — Modify + undo/redo

- ✅ Máquinas de estado `ERASE` / `MOVE` / `COPY` / `ROTATE` / `SCALE` vía `CommandBus`
- ✅ Flujo AutoCAD: selección (`pickSelection`) → punto base (`getPoint`) → parámetro
- ✅ Transformaciones con `AcGeMatrix3d` (`makeTranslation`/`makeRotationZ`/`makeScale`) aplicadas vía `entity.transformBy`
- ✅ Adapter ampliado: `getEntityById` (`btr.getIdAt`), `transformEntity` (refresca vista), `eraseEntity`/`restoreEntity`, `cloneEntity` (`entity.clone()`)
- ✅ `TransactionManager` (singleton) cableado al `CommandBus`; toda modificación pasa por transacciones
- ✅ Comandos `UNDO` / `REDO` funcionales (deshacen/rehacen draw y modify)
- ✅ Draw también registra transacciones (`addWithUndo`: undo = erase de la entidad creada)

> ROTATE calcula el ángulo desde el punto base al punto indicado. SCALE usa la
> distancia base→punto como factor (simplificación, sin reference length). El
> undo de transformaciones aplica la matriz inversa; el undo de COPY borra las
> copias creadas; el undo de ERASE restaura el snapshot clonado.

### MVP 1 — base usable 🟡

OPEN ✅ · LOAD_DXF ✅ · LOAD_DWG ✅ · SAVE_PROJECT 🟡 · LINE ✅ · POLYLINE ✅ ·
RECTANGLE ✅ · CIRCLE ✅ · ERASE ✅ · MOVE ✅ · COPY ✅ · ROTATE ✅ · SCALE ✅ ·
ZOOM 🟡 · PAN 🟡 · SELECT ✅ · LAYER 🟡 · UNDO ✅ · REDO ✅ ·
OSNAP_ENDPOINT ✅ · OSNAP_MIDPOINT ✅ · OSNAP_CENTER ✅ · OSNAP_INTERSECTION ✅ ·
OSNAP_NEAREST ✅ · DIMLINEAR 🟡 · DIMALIGNED 🟡 · DIMANGULAR 🟡

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

## Próximo paso (Paso 6)

- View: `ZOOM` (extents/window), `PAN`, `REGEN` funcionales vía adapter.
- `LAYER`: manager de capas (crear/activar/visibilidad) sobre `database.tables.layerTable`.

## Licencia

Por definir. La librería `@mlightcad/cad-viewer` es MIT.
