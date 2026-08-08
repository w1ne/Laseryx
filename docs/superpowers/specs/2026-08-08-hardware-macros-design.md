# Hardware Macros (FPD-style parts library) — Design

**Date:** 2026-08-08  
**Status:** Draft for review  
**Product:** Laseryx  
**Direction:** Approach A — Front Panel Designer–style parametric macros on the laser canvas

## Goal

Let workshop / hackathon users build **physical interface panels** by placing **hardware blocks** on the design canvas — screen cutouts with mounting holes, pots, buttons, USB slots, panel outlines — as single selectable units that expand to cut geometry and run through the existing CAM → G-code → GRBL path.

## Non-goals (v1)

- Explode macro to independent path objects (may add later)
- Multi-operation macros (cut + engrave label on different layers in one macro)
- Click-to-place on bed, drag handles, rotate, snap (numeric X/Y only first)
- Live electrical control of resistors / pots (params are mechanical / label only)
- User-authored custom macro UI (built-in catalog only)
- Full Front Panel Designer feature parity (threads, countersinks, 19″ system holes, order/price)

## Competitive context (why this)

| World | Examples | Strength | Gap |
| --- | --- | --- | --- |
| Laser apps | LightBurn, xTool, Glowforge | Cut control, art/material libraries | No electronics hardware macros |
| Panel CAD | Front Panel Designer | Macros, D-holes, system holes | No live laser job loop |
| Generators | Boxes.py, MakerCase | Parametric enclosures | Not an interactive panel workbench |

**Opportunity:** browser Laseryx + FPD-style macros + existing agent/MCP control.

## Architecture overview

```
MacroDef (catalog)  →  MacroObj (document instance)  →  expand()  →  polylines
                                                              ↓
                                              DesignView preview + cam.objToPolylines
                                                              ↓
                                                         planCam → G-code → GRBL
```

### Units

1. **MacroDef** — built-in definition: id, display name, param schema, pure `expand(params) → local polylines` (mm, origin at macro local 0,0).
2. **MacroObj** — document object instance; one selection unit; persists with the project.
3. **expand pipeline** — applies instance transform to local polylines; shared by UI and CAM so preview matches cut.
4. **Catalog** — static registry of MacroDefs for the workshop starter set.
5. **UI hooks** — Document “+ Hardware”, Properties param form, DesignView hit-test as whole object.
6. **Agent commands** — `document.addMacro`, `document.updateMacroParams` (reuse transform/layer/delete).

Core stays free of DOM (`apps/pwa/src/core`). UI and automation call services the same way as rectangles today.

## Data model

### MacroObj (extends document `Obj` union)

```ts
type MacroObj = {
  kind: "macro";
  id: string;
  layerId: string;
  transform: Transform; // same affine as path/shape/image
  defId: string;        // catalog key, e.g. "screen-preset"
  params: Record<string, number | string>; // validated against MacroDef schema
};
```

`Obj = PathObj | ShapeObj | ImageObj | MacroObj`

### MacroDef

```ts
type MacroParamSpec = {
  key: string;
  label: string;
  type: "number" | "enum" | "string";
  unit?: "mm";
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[]; // for enum
  default: number | string;
};

type MacroDef = {
  id: string;
  name: string;
  category: "mount" | "display" | "control" | "io" | "panel";
  params: MacroParamSpec[];
  expand: (params: Record<string, number | string>) => PolylinePath[];
};
```

### Persistence

- Macros serialize inside `Document.objects` like other objects.
- Bump `document.version` if required by project load rules; loaders must ignore or soft-fail unknown kinds gracefully if older clients open files (prefer: newer app only for workshop).
- No migration of legacy projects required (empty macros).

### Param validation

- On add / update: coerce numbers, clamp min/max, fill defaults for missing keys.
- Unknown `defId`: reject add with clear error; if loaded from disk with unknown def, show warning object / skip expand with warning in CAM (do not crash).

## Workshop starter catalog

| defId | Name | Key params | Expanded geometry |
| --- | --- | --- | --- |
| `mount-hole` | Mount hole | `diameterMm` | 1 closed circle |
| `mount-4hole` | 4-hole pattern | `widthMm`, `heightMm`, `diameterMm` | 4 circles at rectangle corners |
| `screen` | Screen / display | `preset` or `widthMm`, `heightMm`, `holeDiameterMm`, `holeInsetMm` | 1 rect cutout + 4 holes |
| `pot` | Pot / resistor | `shaftDiameterMm`, `dFlat` (bool/enum), `valueLabel` (string) | shaft circle or D-hole; label is param only (no engrave path in v1) |
| `button` | Button | `diameterMm` (default 16) | 1 circle |
| `usb-c` | USB-C slot | `widthMm`, `heightMm`, `cornerRadiusMm` | rounded rect slot |
| `panel` | Panel outline | `widthMm`, `heightMm`, `cornerRadiusMm`, `includeCornerHoles`, `holeDiameterMm`, `holeInsetMm` | outer path (+ optional 4 corner holes) |

**Screen presets (enum):** e.g. `2.8-ili9341`, `custom` — presets fill W/H/inset; user can override numbers after.

**Pot “resistance”:** optional `valueLabel` (e.g. `"10k"`) and/or package size param; **not** live electronics control.

## Geometry helpers

Under `core/macros/` (or `geom.ts` if tiny):

- `circleToPolyline(cx, cy, r, segments = 32): PolylinePath` (closed)
- `roundedRectToPolyline(...): PolylinePath` (for USB-C)
- D-hole: circle with flat chord for pot when `dFlat` enabled

All coordinates local to macro; instance `transform` applied in expand wrapper used by CAM/UI.

## CAM integration

### Change

In `objToPolylines` (`cam.ts`):

```ts
case "macro":
  return expandMacro(obj); // looks up def, validates params, expand + transform
```

### Rules (v1)

- Macro uses **one** `layerId` → one operation (typically Cut / line mode).
- All expanded paths are closed vector cuts.
- Existing path ordering (`insideOut`, etc.) applies to expanded polylines so holes tend to cut before large outer paths.
- Images/macros/shapes coexistence unchanged.
- No special multi-pass per sub-feature; passes come from the layer operation.

### Preview

`DesignView` renders expanded polylines (or SVG primitives equivalent) for `kind === "macro"`. Selection outline is the **union bbox** of expanded geometry (or def-provided bounds). Click hit-test: any expanded path or bbox — selects the **macro id**, not a child path.

## UI

### Document panel

- Add **+ Hardware** control (dropdown or secondary list) listing catalog by category.
- Keep **Add Rect** and **Import**.
- Object list label: friendly name from def + key param summary (e.g. `Screen 2.8"`, `Pot Ø6`).
- Delete: existing `DELETE_OBJECT`.

### Place flow (v1)

1. User picks a macro from Hardware.
2. `ObjectService.addMacro(state, dispatch, defId, partialParams?)` creates MacroObj at default transform (e.g. `e=10, f=10`) on a line/cut layer (`findOrCreateLayer` with mode `"line"`).
3. Dispatch `ADD_OBJECT` + `SELECT_OBJECT`.
4. Properties shows param form immediately.

**Later (not v1):** click-to-place, drag move, rotate, snap.

### Properties panel

When selected object is `kind === "macro"`:

- X / Y (transform e/f) — same as today
- Layer select — same as today
- Dynamic fields from `MacroDef.params` (number inputs, enum selects, string for labels)
- On change: merge params → validate → `UPDATE_OBJECT` with new `params` (geometry regenerates live)

W/H for free shapes do not apply unless the macro exposes equivalent params.

### Undo

Prefer routing param/transform updates through existing history-aware actions so undo works like other object edits. If history currently only snapshots on certain actions, ensure ADD_OBJECT and UPDATE_OBJECT for macros are included the same way as rects.

## Agent / automation

Extend document command set (same protocol patterns as `document.addRect`):

| Command | Args | Result |
| --- | --- | --- |
| `document.addMacro` | `defId`, optional `params`, `x`, `y`, `layer`, `object` (id) | created MacroObj |
| `document.updateMacroParams` | `object`, `params` (partial merge) | updated MacroObj |

Reuse:

- `document.updateObjectTransform`
- `document.setObjectLayer`
- `document.deleteObject`

Capabilities / MCP tool registration: expose new commands next to `document.addRect` (including hosted allowlist if applicable). Dry-run support if other document commands support it.

## Module layout

```
apps/pwa/src/core/macros/
  types.ts          # MacroDef, MacroParamSpec (if not all in model.ts)
  catalog.ts        # built-in MacroDef registry + getMacroDef(id)
  expand.ts         # expandMacro(obj) / expandDef(def, params, transform)
  geomHelpers.ts    # circle, rounded rect, D-hole
  validateParams.ts # defaults, clamp, coerce

apps/pwa/src/core/model.ts              # MacroObj on Obj union
apps/pwa/src/core/cam.ts                # case "macro"
apps/pwa/src/core/services/ObjectService.ts  # addMacro
apps/pwa/src/ui/components/preview/DesignView.tsx
apps/pwa/src/ui/panels/DocumentPanel.tsx
apps/pwa/src/ui/panels/PropertiesPanel.tsx
apps/pwa/src/automation/browser/documentCommands.ts
# + capability lists / MCP tool maps as needed
```

No DOM in `core/macros`.

## Testing

### Unit

- Each catalog def: expand defaults → stable path count and bbox (snapshot or precise asserts).
- Screen: exactly 1 rect polyline + 4 hole polylines.
- Param change: e.g. larger `diameterMm` increases hole radius / bbox.
- `validateParams`: fill defaults, clamp, reject invalid enum.
- `planCam`: document with one macro on cut layer includes expanded paths; stats/warnings sane.
- Optional golden G-code fixture for a minimal one-macro job.

### Integration / automation

- `ObjectService.addMacro` + reducer stores `kind: "macro"`.
- `document.addMacro` happy path; unknown `defId` → error diagnostic, no throw.
- `document.updateMacroParams` merges params.
- Properties-level update can be covered via service/reducer tests if UI tests are heavy.

## Success criteria (workshop)

1. User places a **panel**, **screen**, **pot**, **button**, **USB-C**, and **mount holes** from Hardware without importing SVG.
2. Changing screen preset or hole Ø updates geometry immediately; part still selects as one object.
3. Generate G-code and preview show all macro cut paths; job is streamable on existing GRBL path.
4. Agent can `document.addMacro` for a screen and `updateMacroParams` without UI.

## Implementation order (for later plan)

1. Types + circle helper + expand + catalog (2–3 defs) + cam branch + unit tests  
2. ObjectService + Document Hardware menu + DesignView render/select  
3. Properties param form  
4. Remaining catalog defs (screen presets, pot D-hole, USB, panel)  
5. Agent commands + capability/MCP wiring + tests  
6. Optional golden G-code + workshop sample project

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Circle approximation quality | 32+ segments; configurable later |
| Hit-test only bbox is loose | Acceptable v1; tighten to path distance later |
| History misses param edits | Explicitly include UPDATE_OBJECT in history policy |
| Catalog growth / wrong footprints | Start with labeled “workshop approx” dims; presets documented |
| Scope creep to full FPD | Non-goals list; reject multi-op and custom authoring in v1 |

## Open decisions (resolved for v1)

- **Approach:** A — parametric macros (not explode-only templates).  
- **Place:** default offset insert, not click-to-place.  
- **Engrave labels:** out of scope; pot value is metadata/string only.  
- **Multi-layer macros:** out of scope.
