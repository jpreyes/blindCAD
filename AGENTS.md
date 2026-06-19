# AGENTS.md

## Project: Web CAD estructural cliente/PWA

Este proyecto busca construir una aplicación CAD 2D estructural, del lado del cliente, instalable como PWA y lo más agnóstica posible del sistema operativo.

La aplicación debe estar basada en una librería web CAD como `mlightcad/cad-viewer` o una alternativa equivalente que permita abrir archivos DWG/DXF en el navegador. El objetivo no es clonar AutoCAD completo, sino construir una herramienta CAD estructural intermedia, práctica y rápida para producir planos estructurales.

El producto debe sentirse familiar para usuarios de AutoCAD, especialmente mediante línea de comandos, aliases, íconos, capas, cotas, hatch, bloques, layouts, viewports y herramientas estructurales específicas.

---

## Objetivo general

Construir un CAD 2D estructural web/PWA con las siguientes características:

- 100% cliente cuando sea posible.
- Offline-first.
- Instalación como PWA.
- Compatible con Windows, Linux, macOS, Android tablets, iPad y navegadores modernos.
- Apertura de DWG/DXF mediante CAD-viewer o motor equivalente.
- Edición 2D suficiente para planos estructurales.
- Línea de comando tipo AutoCAD.
- Íconos y menús que ejecuten los mismos comandos que la línea de comando.
- Guardado de proyecto local.
- Exportación a DXF/PDF cuando sea posible.
- Herramientas estructurales inspiradas en flujos tipo AutoRebar y JTLSteel, sin intentar copiarlos al 100%.

---

## Principio más importante

Todas las acciones CAD deben ser dirigidas por comandos.

Los botones, menús, shortcuts, aliases y línea de comando deben llamar al mismo `CommandRegistry`.

No debe existir lógica duplicada entre la UI y la línea de comando.

Ejemplo correcto:

```ts
commandBus.run("TRIM");        // Botón Trim
commandBus.run("TRIM");        // Menú Modify > Trim
commandBus.run(resolveAlias("TR")); // Línea de comando: TR
```

Ejemplo incorrecto:

```ts
trimFromButton();
trimFromCommandLine();
trimFromMenu();
```

La UI solo debe ser una forma visual de lanzar comandos. El núcleo debe ser el sistema de comandos.

---

## Arquitectura esperada

La arquitectura debe separar claramente la lógica CAD de la UI.

Estructura sugerida:

```txt
src/
  app/
    App.tsx
    layout/
    panels/
    toolbar/
    command-line/

  cad-core/
    commands/
    command-registry.ts
    command-bus.ts
    aliases.ts
    command-types.ts

    geometry/
    entities/
    transactions/
    selection/
    snaps/
    layers/
    blocks/
    dimensions/
    hatches/
    layouts/
    viewports/
    plotting/

  cad-adapters/
    cad-viewer/
      cad-viewer-adapter.ts
      cad-viewer-selection-adapter.ts
      cad-viewer-render-adapter.ts

  structural/
    rebar/
    steel/
    symbols/
    schedules/
    templates/

  storage/
    file-system-access.ts
    indexed-db.ts
    project-serializer.ts
    dxf-export.ts
    pdf-export.ts

  ui/
    icons/
    components/
    theme/
```

No crear demasiados archivos innecesarios. Si una función es pequeña, mantenerla cerca de su módulo. Separar solo cuando haya una razón clara.

---

## Capas principales

### 1. CAD viewer adapter

La librería CAD externa, por ejemplo `cad-viewer`, debe tratarse como motor de visualización/carga, no como dueño de toda la aplicación.

Crear un adaptador:

```ts
interface CadViewerAdapter {
  loadFile(file: File): Promise<void>;
  getEntities(): CadEntity[];
  addEntity(entity: CadEntity): void;
  updateEntity(entity: CadEntity): void;
  removeEntity(id: EntityId): void;
  refresh(): void;
  zoomExtents(): void;
}
```

La aplicación no debe depender directamente de detalles internos del visor en todos lados. Cualquier dependencia debe pasar por el adapter.

---

### 2. CommandRegistry

Cada comando debe registrarse con metadatos.

```ts
type CadCommand = {
  id: string;
  aliases: string[];
  label: string;
  description?: string;
  icon?: string;
  group:
    | "file"
    | "draw"
    | "modify"
    | "annotate"
    | "layers"
    | "blocks"
    | "layout"
    | "view"
    | "structural"
    | "snaps";
  tooltip?: string;
  run: (ctx: CadContext, args?: CommandArgs) => Promise<void> | void;
};
```

Ejemplo:

```ts
registerCommand({
  id: "TRIM",
  aliases: ["TR"],
  label: "Trim",
  icon: "trim",
  group: "modify",
  tooltip: "Trim selected entities. Alias: TR",
  run: trimCommand,
});
```

---

### 3. CommandBus

El `CommandBus` debe ser la única entrada para ejecutar acciones CAD.

Debe permitir:

- Ejecutar por ID.
- Ejecutar por alias.
- Cancelar comando actual.
- Guardar historial.
- Mostrar prompts en la línea de comando.
- Manejar comandos multi-paso.
- Manejar opciones tipo AutoCAD.

Ejemplo:

```ts
commandBus.run("ROTATE");
commandBus.run("ROTATE", { mode: "reference" });
commandBus.run(resolveAlias("RO"));
commandBus.cancel();
```

---

### 4. Comandos como máquinas de estado

Los comandos CAD no son solo funciones simples. Muchos son secuencias interactivas.

Ejemplo `TRIM`:

```txt
Command: TRIM
Select cutting edges:
Select objects to trim:
Pick side to trim:
```

Ejemplo `ROTATE`:

```txt
Command: ROTATE
Select objects:
Specify base point:
Specify rotation angle or [Reference]:
```

Ejemplo `SCALE`:

```txt
Command: SCALE
Select objects:
Specify base point:
Specify scale factor or [Reference]:
```

Cada comando complejo debe poder comportarse como máquina de estados.

---

## Línea de comando

La línea de comando es el mecanismo principal de interacción.

Debe soportar:

- Escribir comandos completos.
- Escribir aliases.
- Mostrar prompts.
- Mostrar opciones.
- Cancelar con ESC.
- Repetir último comando con Enter o Space.
- Historial con flechas.
- Comandos transparentes cuando sea posible en el futuro.

Ejemplos:

```txt
Command: L
Specify first point:
Specify next point:
```

```txt
Command: TR
Select cutting edges:
Select objects to trim:
```

```txt
Command: RO
Select objects:
Specify base point:
Specify rotation angle or [Reference]:
```

---

## Íconos y toolbar

Aunque la línea de comando sea prioritaria, la aplicación también debe tener íconos.

Regla obligatoria:

Los íconos no implementan lógica propia. Cada ícono llama a `commandBus.run(COMMAND_ID)`.

Ejemplo:

```tsx
<ToolbarButton
  icon="trim"
  label="Trim"
  tooltip="Trim - Alias: TR"
  onClick={() => commandBus.run("TRIM")}
/>
```

Los tooltips deben mostrar el nombre del comando y su alias.

Ejemplo:

```txt
Trim
Command: TRIM
Alias: TR
```

Los botones con opciones deben usar menú desplegable o long press.

Ejemplo `ROTATE`:

```txt
Rotate
Rotate with Reference
```

Internamente:

```ts
commandBus.run("ROTATE");
commandBus.run("ROTATE", { mode: "reference" });
```

---

## Organización visual sugerida

Interfaz recomendada:

```txt
Top menu:
File | Edit | View | Draw | Modify | Annotate | Structural | Layout

Left toolbar:
Draw / Modify / Annotate / Structural

Bottom:
Command line

Right panel:
Properties / Layers / Blocks
```

La interfaz debe ser simple, clara y rápida. No crear un ribbon gigante tipo AutoCAD completo al principio.

Priorizar:

- Barra lateral izquierda con comandos frecuentes.
- Línea de comando inferior siempre accesible.
- Panel derecho para propiedades/capas/bloques.
- Menús superiores para comandos menos usados.
- Diseño usable en desktop y tablet.

---

## Tablet / iPad

La aplicación debe considerar uso en tablet.

Requisitos:

- Íconos suficientemente grandes.
- Long press para opciones.
- Botón visible para ESC / Cancel.
- Botón visible para ORTHO.
- Botón visible para OSNAP.
- Pan/zoom con gestos.
- Línea de comando opcional o colapsable.
- Teclado físico soportado si está disponible.

En tablet, el usuario debe poder trabajar sin teclado físico.

---

## Aliases mínimos

Implementar estos aliases desde el inicio o preparar la estructura para ellos.

### Draw

```txt
L      LINE
PL     POLYLINE
REC    RECTANGLE
C      CIRCLE
A      ARC
T      TEXT
MT     MTEXT
ML     MULTILINE
```

### Modify

```txt
M      MOVE
CO     COPY
CP     COPY
RO     ROTATE
SC     SCALE
TR     TRIM
EX     EXTEND
O      OFFSET
X      EXPLODE
E      ERASE
MI     MIRROR
F      FILLET
CHA    CHAMFER
BR     BREAK
J      JOIN
ST     STRETCH
```

### Annotation

```txt
DIM    DIMENSION
DLI    DIMLINEAR
DAL    DIMALIGNED
DAN    DIMANGULAR
DRA    DIMRADIUS
DDI    DIMDIAMETER
DCO    DIMCONTINUE
DBA    DIMBASELINE
LE     LEADER
H      HATCH
WIPEOUT WIPEOUT
```

### Layers / properties

```txt
LA     LAYER
MA     MATCHPROP
PR     PROPERTIES
```

### Blocks

```txt
B      BLOCK
I      INSERT
BE     BLOCKEDIT
WBLOCK WBLOCK
```

### View / layout

```txt
Z      ZOOM
P      PAN
RE     REGEN
MS     MODELSPACE
PS     PAPERSPACE
MV     MVIEW
```

### Structural

```txt
RBAR   REBAR
RSTIR  STIRRUP
RSET   REBARSET
RCALL  REBARCALLOUT
RTABLE REBARSCHEDULE
SPROF  STEELPROFILE
PLATE  PLATE
BOLT   BOLTGROUP
WELD   WELD
SECT   SECTIONTAG
```

---

## Comandos mínimos para MVP 1

El primer MVP debe priorizar una experiencia CAD usable, no una lista enorme de features.

MVP 1:

```txt
OPEN
SAVE_PROJECT
LOAD_DWG
LOAD_DXF
LINE
POLYLINE
RECTANGLE
CIRCLE
ERASE
MOVE
COPY
ROTATE
SCALE
ZOOM
PAN
SELECT
LAYER
UNDO
REDO
OSNAP_ENDPOINT
OSNAP_MIDPOINT
OSNAP_CENTER
OSNAP_INTERSECTION
DIMLINEAR
DIMALIGNED
DIMANGULAR
```

---

## MVP 2: modificación y anotación

```txt
TRIM
EXTEND
OFFSET
EXPLODE
MIRROR
JOIN
BREAK
FILLET
CHAMFER
TEXT
MTEXT
HATCH_SOLID
HATCH_ANSI31
WIPEOUT
```

---

## MVP 3: planos reales

```txt
BLOCK
INSERT
EXPLODE_BLOCK
MULTILINE
LAYOUT
VIEWPORT
VIEWPORT_SCALE
VIEWPORT_LOCK
TITLE_BLOCK
PRINT_PDF
EXPORT_DXF
```

---

## MVP 4: herramientas estructurales

```txt
REBAR
STIRRUP
REBARSET
REBARCALLOUT
REBARSCHEDULE
STEELPROFILE
PLATE
BOLTGROUP
WELD
SECTIONTAG
DETAILCALLOUT
```

---

## Dimensions

Las dimensiones deben implementarse inicialmente como entidades compuestas propias.

No esperar a que el motor CAD externo soporte dimensiones nativas perfectas.

Una dimensión debe contener:

```txt
DimensionEntity
  id
  type
  measuredPoints
  extensionLines
  dimensionLine
  arrows
  text
  measuredValue
  style
  layer
  color
  scale
  associative
```

Al inicio, `associative` puede ser `false`.

Tipos mínimos:

```txt
DIMLINEAR
DIMALIGNED
DIMANGULAR
DIMRADIUS
DIMDIAMETER
DIMCONTINUE
DIMBASELINE
```

Las dimensiones deben poder:

- Mostrarse correctamente.
- Moverse.
- Escalarse.
- Editar texto.
- Regenerarse si cambia el estilo.
- Exportarse como geometría y texto si no existe exportación nativa.

---

## Hatch

El hatch debe partir simple.

Primera implementación:

```txt
HATCH_SOLID
HATCH_ANSI31
HATCH_CONCRETE
HATCH_STEEL
HATCH_EARTH
```

No implementar detección compleja automática de contornos al inicio.

Flujo inicial:

```txt
Command: HATCH
Select closed polyline boundary:
Choose pattern:
Specify scale:
Specify angle:
```

El hatch debe tener:

```txt
HatchEntity
  id
  boundaryEntityId
  boundaryPoints
  pattern
  scale
  angle
  layer
  color
```

---

## Blocks

Implementar bloques básicos.

Comandos:

```txt
BLOCK
INSERT
EXPLODE
BLOCK_LIBRARY
```

Un bloque debe tener:

```txt
BlockDefinition
  id
  name
  basePoint
  entities
```

Una inserción debe tener:

```txt
BlockReference
  id
  blockId
  insertionPoint
  scaleX
  scaleY
  rotation
  layer
  attributes
```

Los bloques son fundamentales para:

- Ejes.
- Cortes.
- Detalles.
- Cajetines.
- Símbolos de soldadura.
- Barras.
- Perfiles.
- Pernos.
- Llamadas estructurales.

---

## Multiline

Implementar `MULTILINE` como polilínea central con offsets paralelos.

Primera versión:

```txt
ML
Specify start point:
Specify next point:
```

Opciones mínimas:

```txt
Justification: Top / Zero / Bottom
Scale
Style
Explode to polylines
```

No implementar toda la complejidad de AutoCAD al inicio.

---

## Wipeout

Implementar `WIPEOUT` como polígono de máscara.

Primera versión:

```txt
WipeoutEntity
  id
  boundaryPoints
  drawOrder
  backgroundMode
```

Puede renderizarse como polígono relleno con el color de fondo.

Debe respetar el orden de dibujo.

Si la exportación nativa no está disponible, exportar como hatch sólido blanco o geometría equivalente.

---

## Layouts y viewports

El sistema debe soportar Model Space y Paper Space.

Modelo sugerido:

```txt
ModelSpace
  entities[]

Layout
  id
  name
  paperSize
  units
  titleBlock
  viewports[]
  paperEntities[]
```

Viewport:

```txt
Viewport
  id
  layoutId
  boundary
  centerModel
  scale
  rotation
  locked
  visibleLayersOverride
```

Requisitos:

- Modelo en escala 1:1.
- Layouts para A1, A2, A3, A4.
- Viewports con escala.
- Bloqueo de viewport.
- Cajetín.
- Exportación PDF.
- Impresión a escala.

---

## Structural tools

No intentar portar AutoRebar o JTLSteel al 100%.

Crear herramientas propias inspiradas en las funciones más útiles.

### Rebar

Comandos:

```txt
REBAR
STIRRUP
REBARSET
REBARCALLOUT
REBARSCHEDULE
```

Objetos:

```txt
RebarEntity
  id
  diameter
  shape
  points
  hooks
  cover
  quantity
  spacing
  label
  layer
```

Ejemplo de salida gráfica:

```txt
- polilínea de barra
- ganchos
- texto 4Ø16
- líder
- atributo para tabla
```

### Stirrup

```txt
StirrupEntity
  id
  diameter
  width
  height
  hookType
  spacing
  label
```

### Rebar set

```txt
RebarSet
  id
  barDefinition
  startPoint
  endPoint
  spacing
  count
  distributionLine
```

### Steel

Comandos:

```txt
STEELPROFILE
PLATE
BOLTGROUP
WELD
SECTIONTAG
DETAILCALLOUT
```

Perfiles iniciales:

```txt
IPE
IPN
HEA
HEB
UPN
L
TUBE_RECT
TUBE_CIRC
PLATE
```

El objetivo inicial es dibujar y anotar rápido, no calcular conexiones completas.

---

## Layers estructurales sugeridas

Crear una plantilla inicial de capas:

```txt
S-AXIS
S-CONCRETE
S-REBAR
S-REBAR-TEXT
S-STEEL
S-STEEL-TEXT
S-BOLTS
S-WELDS
S-DIMS
S-TEXT
S-HATCH
S-HIDDEN
S-CENTER
S-DETAIL
S-VIEWPORT
S-TITLEBLOCK
S-WIPEOUT
```

---

## Guardado y persistencia

No depender inicialmente de guardar DWG perfecto.

Estrategia recomendada:

```txt
drawing.dwg
drawing.cadstruct.json
drawing.pdf
drawing.dxf
```

El archivo `cadstruct.json` debe guardar:

```json
{
  "version": "0.1.0",
  "sourceFile": "drawing.dwg",
  "entities": [],
  "dimensions": [],
  "hatches": [],
  "blocks": [],
  "layouts": [],
  "viewports": [],
  "structuralObjects": [],
  "layerStates": [],
  "settings": {}
}
```

La app debe poder:

- Abrir DWG/DXF original.
- Cargar sidecar JSON.
- Reproducir las ediciones propias.
- Guardar proyecto local.
- Exportar PDF.
- Exportar DXF si está disponible.

---

## Offline / PWA

La app debe ser offline-first.

Usar:

- Service worker.
- Cache de assets.
- IndexedDB para proyectos recientes.
- File System Access API cuando esté disponible.
- Fallback con input/download para navegadores sin soporte completo.
- Exportación manual como respaldo.

No asumir que todos los navegadores permiten acceso completo al sistema de archivos.

---

## Undo / redo

Toda modificación debe pasar por un sistema de transacciones.

Ejemplo:

```ts
transactionManager.run({
  name: "MOVE",
  do: () => moveEntities(ids, vector),
  undo: () => moveEntities(ids, inverseVector),
});
```

No modificar entidades directamente desde la UI.

---

## Selection

Implementar:

```txt
Single select
Window select
Crossing select
Add/remove selection
Selection filters
Highlight
Grip points
```

MVP mínimo:

```txt
Click select
Shift add/remove
Window select
Delete selected
```

---

## OSNAP

MVP mínimo:

```txt
Endpoint
Midpoint
Center
Intersection
Nearest
```

Futuro:

```txt
Perpendicular
Tangent
Quadrant
Node
Extension
Tracking
```

El OSNAP debe ser compartido por todos los comandos.

No implementar snaps separados por comando.

---

## Properties panel

El panel de propiedades debe mostrar y permitir editar:

```txt
Layer
Color
Linetype
Lineweight
Position
Length
Radius
Text
Rotation
Scale
Block name
Dimension style
Hatch pattern
```

El panel no debe modificar entidades directamente. Debe usar transacciones/comandos.

---

## Iconos

Usar íconos SVG propios o una librería de íconos genérica.

No copiar íconos propietarios de AutoCAD ni de plugins comerciales.

Cada comando debe tener:

```txt
icon
label
tooltip
alias visible
group
```

Ejemplo:

```ts
{
  id: "TRIM",
  icon: "trim",
  label: "Trim",
  tooltip: "Trim - Alias: TR",
  group: "modify"
}
```

---

## Estilo de desarrollo para agentes IA

Cuando trabajes en este repositorio:

1. Lee primero la arquitectura existente.
2. No hagas reescrituras grandes sin necesidad.
3. Implementa una feature por vez.
4. Mantén la lógica CAD separada de la UI.
5. No dupliques lógica entre botones y línea de comando.
6. Antes de crear archivos nuevos, revisa si existe un módulo adecuado.
7. Prefiere interfaces claras y simples.
8. Agrega tipos TypeScript.
9. Agrega tests de geometría cuando corresponda.
10. No rompas la apertura/renderizado de DWG/DXF.
11. No dependas de backend para funciones esenciales.
12. Mantén el proyecto usable offline.
13. Haz cambios pequeños y revisables.
14. Explica brevemente qué cambiaste y por qué.
15. Si algo no está claro, implementa la solución mínima razonable y deja TODOs explícitos.

---

## Reglas estrictas

- No crear una aplicación empresarial pesada.
- No crear un clon completo de AutoCAD.
- No crear diez abstracciones si una interfaz simple basta.
- No mezclar UI con geometría.
- No implementar lógica de comando dentro de componentes visuales.
- No depender de internet para abrir/editar archivos locales.
- No asumir que guardar DWG será perfecto desde el inicio.
- No romper la experiencia de línea de comando.
- No ocultar los aliases.
- No usar íconos propietarios.
- No portar plugins comerciales directamente.

---

## Prioridad técnica

Orden recomendado de implementación:

```txt
1. CommandRegistry
2. CommandBus
3. Aliases
4. Command line UI
5. Toolbar icons using CommandBus
6. Selection manager
7. OSNAP manager
8. Basic draw commands
9. Basic modify commands
10. Undo/redo transactions
11. Dimensions
12. Hatch
13. Blocks
14. Layouts/viewports
15. Export PDF/DXF
16. Structural tools
```

---

## Definición de éxito

El proyecto será exitoso si permite a un ingeniero estructural:

- Abrir un DWG/DXF.
- Navegar fluidamente.
- Usar comandos tipo AutoCAD.
- Usar aliases familiares.
- Editar geometría básica.
- Acotar correctamente.
- Crear hatch.
- Insertar bloques.
- Trabajar con layouts y viewports.
- Exportar PDF.
- Dibujar detalles estructurales frecuentes.
- Dibujar barras, estribos, perfiles, soldaduras, pernos y llamadas.
- Trabajar offline.
- Usar la app en distintos sistemas operativos.

El objetivo es lograr una herramienta intermedia, práctica y productiva para planos estructurales, no una reproducción completa de AutoCAD.
