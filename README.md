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
11. Dimensions ✅
12. Hatch ✅ (HATCH_SOLID/ANSI31)
13. Blocks ✅ (BLOCK/INSERT/EXPLODE_BLOCK)
14. Layouts/viewports ✅ (LAYOUT/VIEWPORT/TITLE_BLOCK; scale/lock pendiente)
15. Export PDF/DXF ✅
16. Structural tools ✅ (REBAR/STIRRUP/REBARSET/REBARCALLOUT/REBARSCHEDULE/STEELPROFILE/PLATE/BOLTGROUP/WELD/SECTIONTAG/DETAILCALLOUT)

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

### Paso 6 — View (ZOOM/PAN/REGEN) + LAYER

- ✅ Comandos `ZOOM` (extents o ventana), `PAN` (dos puntos), `REGEN` funcionales
- ✅ ZOOM: si se cancela en el primer punto → zoom extents; si no, zoom ventana
- ✅ Adapter ampliado con métodos de capas: `listLayers`/`createLayer`/`setLayerVisible`/`setCurrentLayer`/`getCurrentLayer`
- ✅ Comando `LAYER`: crea las **capas estructurales** (plantilla AGENTS.md) con colores por defecto y lista el estado
- ✅ Panel **Layers**: lista capas, toggle visibilidad (bulb), establecer capa actual (click nombre)
- ✅ Visibilidad via `layerTable.getAt` + `view.updateLayer` (refresca render)
- ✅ Capa actual via `database.clayer`

> Colores por defecto: S-AXIS dorado, S-REBAR naranjo, S-STEEL azul, S-BOLTS/WELDS rojo,
> S-DIMS celeste, S-TEXT gris claro, S-HATCH gris, S-HIDDEN gris oscuro, S-CENTER verde.

### Paso 7 — Dimensions (completa MVP 1)

- ✅ Máquinas de estado `DIMLINEAR` / `DIMALIGNED` / `DIMANGULAR` vía `CommandBus`
- ✅ Entidades nativas `@mlightcad/data-model`: `AcDbRotatedDimension`, `AcDbAlignedDimension`, `AcDb3PointAngularDimension`
- ✅ `adapter.addDimension(dim)`: maneja el dim block interno (`createDimBlock` + `blockTable.add` + `dimBlockId` + `appendEntity` + `view.addEntity`)
- ✅ DIMLINEAR auto-detecta horizontal/vertical según la posición de la línea de cota
- ✅ DIMALIGNED mide la distancia paralela entre los dos puntos
- ✅ DIMANGULAR mide el ángulo entre vértice y dos extremos (4 puntos)
- ✅ Dimensiones con undo (undo = erase de la dimensión creada)
- ✅ Seed-commands vacío: todos los comandos MVP1 están implementados en sus módulos

> DIMLINEAR pide origen de 2 líneas de extensión + ubicación de línea de cota;
> auto-detecta H/V. DIMALIGNED pide 2 orígenes + ubicación. DIMANGULAR pide
> vértice + 2 extremos + ubicación del arco. El texto de cota se calcula automáticamente.

### Paso 8 — MVP 2: modificación y anotación

- ✅ `TEXT` / `MTEXT`: texto simple y multilinea (AcDbText/AcDbMText, input de string vía editor)
- ✅ `MIRROR`: refleja sobre una línea (matriz de reflexión makeScale(-1,1,1) + rotación/traslación)
- ✅ `OFFSET`: offset de curvas vía `AcDbCurve.getOffsetCurves(distance)`
- ✅ `EXPLODE`: polyline → líneas individuales (con undo: restaura polyline)
- ✅ `BREAK`: divide una línea en dos en un punto
- ✅ `JOIN`: une líneas colineales en una sola (extremos más alejados)
- ✅ `HATCH_SOLID`: relleno sólido (patternName=SOLID, loop desde polyline cerrada)
- ✅ `HATCH_ANSI31` (alias `H`): patrón ANSI31 (Predefined, AcGePolyline2d como boundary)
- ✅ `WIPEOUT`: máscara rectangular (AcDbWipeout)
- 🟡 `TRIM` / `EXTEND` / `FILLET` / `CHAMFER`: stubs con TODO (requieren geometría de intersecciones)

> Hatch: selecciona una polyline cerrada como boundary. Wipeout: dos esquinas.
> Offset: distancia (2 puntos) + objeto + punto lateral. Mirror: selección + eje (2 puntos).
> Explode/Break/Join operan sobre líneas/polylines con undo completo.

### Paso 9 — MVP 3: planos reales

- ✅ `BLOCK` (crea definición desde entidades seleccionadas + base point), `INSERT` (referencia por nombre), `EXPLODE_BLOCK` (descompone referencia en entidades transformadas por `blockTransform`)
- ✅ `MULTILINE` (alias `ML`): polilínea central con offsets paralelos (`AcDbMLine`, `appendSegment` con direction/miter)
- ✅ `LAYOUT`: crea paper space layout (A3 por defecto) vía `AcDbLayoutManager.createLayout`
- ✅ `VIEWPORT` (alias `MV`): crea viewport rectangular en el layout (escala ~1:50 por defecto)
- ✅ `TITLE_BLOCK`: inserta cajetín A3 (block auto-creado: rectángulo 420x297 + línea divisoria)
- ✅ `EXPORT_DXF`: `database.dxfOut(undefined, 6)` → Blob → descarga `drawing.dxf`
- ✅ `PRINT_PDF`: `@mlightcad/cad-pdf-plugin` (AcApPdfConvertor) → descarga PDF vectorial
- 🟡 `VIEWPORT_SCALE` / `VIEWPORT_LOCK`: stubs con TODO (escala/bloqueo interactivo)

> Adapter ampliado con: `createBlock`/`hasBlock`/`listBlocks`, `createLayout`/`listLayouts`/`setCurrentLayout`/`addViewport`,
> `exportDxf`/`exportPdf`, `database` (getter). Plugin PDF instalado como dependencia.

### Paso 10 — MVP 4: herramientas estructurales

- ✅ `REBAR` (alias `RBAR`): barra con ganchos 135° + etiqueta Øn (capa S-REBAR)
- ✅ `STIRRUP` (alias `RSTIR`): estribo rectangular con gancho (capa S-REBAR)
- ✅ `REBARSET` (alias `RSET`): distribuye barras a lo largo de una línea con spacing + etiqueta `nØØ@spacing`
- ✅ `REBARCALLOUT` (alias `RCALL`): líder + etiqueta de llamada de barra (S-REBAR-TEXT)
- ✅ `REBARSCHEDULE` (alias `RTABLE`): tabla de despiece (grid líneas + headers: Mark/Ø/Length/Qty/Total)
- ✅ `STEELPROFILE` (alias `SPROF`): perfiles IPE/IPN/HEA/HEB/UPN/L/TUBE_RECT/TUBE_CIRC (sección transversal, S-STEEL)
- ✅ `PLATE`: placa rectangular + etiqueta de dimensiones (S-STEEL)
- ✅ `BOLTGROUP` (alias `BOLT`): grupo de pernos en patrón lineal (S-BOLTS)
- ✅ `WELD` (alias `WELD`): símbolo de soldadura FILLET/BEVEL (línea ref + flecha + triángulo/V, S-WELDS)
- ✅ `SECTIONTAG` (alias `SECT`): símbolo de corte (línea + burbujas con etiqueta en extremos, S-DETAIL)
- ✅ `DETAILCALLOUT`: llamada de detalle (burbuja con nº detalle/referencia lámina + líder, S-DETAIL)

> Cada comando dibuja geometría compuesta (polylines/líneas/círculos/texto) en las capas
> estructurales (S-REBAR, S-STEEL, S-BOLTS, S-WELDS, S-DETAIL, ...). Per AGENTS.md:
> "el objetivo inicial es dibujar y anotar rápido, no calcular conexiones completas".

### Paso 11 — Post-MVP: geometría, persistencia, viewports, matchprop

- ✅ `SAVE_PROJECT`: serializa la database a DXF embebido en `.cadstruct.json` (File System Access API + fallback descarga), guarda en IndexedDB como proyecto reciente
- ✅ `TRIM` (alias `TR`): recorta línea en la intersección con cutting edges (cálculo manual de intersección de segmentos)
- ✅ `EXTEND` (alias `EX`): extiende línea hasta boundary edge (intersección de líneas infinitas)
- ✅ `FILLET` (alias `F`): arco tangente entre dos líneas + recorte (AcDbArc + líneas ajustadas)
- ✅ `CHAMFER` (alias `CHA`): bisel entre dos líneas (distancias d1/d2, línea de chamfer + recorte)
- ✅ `VIEWPORT_SCALE`: establece escala 1:n del viewport (`viewHeight = paperHeight * n`)
- ✅ `VIEWPORT_LOCK`: bloquea/desbloquea viewport (estado en memoria)
- ✅ `MATCHPROP` (alias `MA`): copia capa/color de una entidad origen a otras

> Geometría (TRIM/EXTEND/FILLET/CHAMFER) soporta `AcDbLine` (segmentos rectos).
> Intersecciones calculadas manualmente en `cad-core/geometry/intersect.ts`.
> Para curvas complejas (arcos/círculos/polylines con bulge) se deja TODO.
>
> Persistencia: `storage/indexed-db.ts` (proyectos recientes), `storage/project-serializer.ts`
> (cadstruct.json con DXF embebido + File System Access API).

### MVP 1 — base usable ✅

OPEN ✅ · LOAD_DXF ✅ · LOAD_DWG ✅ · SAVE_PROJECT ✅ · LINE ✅ · POLYLINE ✅ ·
RECTANGLE ✅ · CIRCLE ✅ · ERASE ✅ · MOVE ✅ · COPY ✅ · ROTATE ✅ · SCALE ✅ ·
ZOOM ✅ · PAN ✅ · SELECT ✅ · LAYER ✅ · UNDO ✅ · REDO ✅ ·
OSNAP_ENDPOINT ✅ · OSNAP_MIDPOINT ✅ · OSNAP_CENTER ✅ · OSNAP_INTERSECTION ✅ ·
OSNAP_NEAREST ✅ · REGEN ✅ · DIMLINEAR ✅ · DIMALIGNED ✅ · DIMANGULAR ✅

> **MVP 1 completo.**

### MVP 2 — modificación y anotación ✅

TRIM ✅ · EXTEND ✅ · OFFSET ✅ · EXPLODE ✅ · MIRROR ✅ · JOIN ✅ · BREAK ✅ ·
FILLET ✅ · CHAMFER ✅ · TEXT ✅ · MTEXT ✅ · HATCH_SOLID ✅ · HATCH_ANSI31 ✅ ·
WIPEOUT ✅

### MVP 3 — planos reales ✅

BLOCK ✅ · INSERT ✅ · EXPLODE_BLOCK ✅ · MULTILINE ✅ · LAYOUT ✅ · VIEWPORT ✅ ·
VIEWPORT_SCALE ✅ · VIEWPORT_LOCK ✅ · TITLE_BLOCK ✅ · PRINT_PDF ✅ · EXPORT_DXF ✅

### MVP 4 — herramientas estructurales ✅

REBAR ✅ · STIRRUP ✅ · REBARSET ✅ · REBARCALLOUT ✅ · REBARSCHEDULE ✅ ·
STEELPROFILE ✅ · PLATE ✅ · BOLTGROUP ✅ · WELD ✅ · SECTIONTAG ✅ · DETAILCALLOUT ✅

> **MVP 4 completo.** Las 11 herramientas estructurales están implementadas.

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

## Próximo paso (mejoras futuras)

- **Grips:** puntos de agarre para edición in-place
- **Geometría avanzada:** TRIM/EXTEND/FILLET/CHAMFER con arcos/círculos/polylines con bulge
- **PROPERTIES panel:** edición de propiedades de entidad seleccionada
- **Command aliases customizables** y autocompletado en la línea de comando
- **Command history** navegable con flechas
- **Tracking/polar**

## Licencia

Por definir. La librería `@mlightcad/cad-viewer` es MIT.
