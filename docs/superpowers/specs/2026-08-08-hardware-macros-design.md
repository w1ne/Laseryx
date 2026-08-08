# Hardware Macros (workshop parts library) — Design

**Date:** 2026-08-08  
**Status:** Draft for review (revised after design roast)  
**Product:** Laseryx  
**Direction:** Approach A — parametric hardware macros on the laser canvas  

**Honesty label (product + docs):**  
Footprints are **workshop-approximate**. UI and catalog copy must say so (e.g. “Verify against datasheet before final cut”). This is **not** Front Panel Designer parity — it is the FPD *idea* (place parts as blocks) on a laser workbench.

## Goal

Let workshop / hackathon users build **physical interface panels** by placing **hardware blocks** on the design canvas — panel outline, screen cutout + mounts, simple controls, mounting holes — as single selectable units that expand to cut geometry and run through the existing CAM → G-code → GRBL path.

## Non-goals (v1)

- Explode macro to independent path objects
- Multi-operation macros (cut + engrave on different layers in one macro)
- Drag handles, rotate UI, snap, full free-move editor
- Live electrical control of resistors / pots
- User-authored custom macro UI
- Full FPD parity (threads, countersinks, 19″ system holes, order/price, edge-USB depth modeling)
- Pot/resistance **labels as geometry** (no engraver text from macros in v1)
- USB-C / D-hole pot as **success-blocking** catalog items (post-v1 / stretch)

## Competitive context (why this)

| World | Examples | Strength | Gap |
| --- | --- | --- | --- |
| Laser apps | LightBurn, xTool, Glowforge | Cut control, art/material libraries | No electronics hardware macros |
| Panel CAD | Front Panel Designer | Macros, D-holes, system holes | No live laser job loop |
| Generators | Boxes.py, MakerCase | Parametric enclosures | Not an interactive panel workbench |
| Laseryx today | SVG import + rect | Already cuts freeform | Import wins if place UX is worse than SVG |

**Opportunity:** macros win only if placing is faster than importing SVG. Place UX is therefore first-class, not optional polish.

## Architecture overview

```
MacroDef (catalog, versioned)  →  MacroObj (document)  →  expand()  →  polylines
                                                                      ↓
                                                  DesignView preview + cam.objToPolylines
                                                                      ↓
                                                             planCam → G-code → GRBL
```

### Units

1. **MacroDef** — built-in definition: id, `defVersion`, display name, param schema, pure expand in local mm.
2. **MacroObj** — document instance; one selection unit; stores `defId`, `defVersion`, validated `params`, transform, layer.
3. **expand pipeline** — shared by UI and CAM so preview matches cut.
4. **Catalog** — static registry; `CATALOG_VERSION` constant for the whole set.
5. **UI hooks** — Hardware menu, Properties, DesignView whole-object select.
6. **Agent** — add/update macros + catalog discovery.

Core stays free of DOM (`apps/pwa/src/core`).

---

## Data model

### MacroObj

```ts
type MacroObj = {
  kind: "macro";
  id: string;
  layerId: string;
  transform: Transform;
  defId: string;
  /** Frozen at place/update time so geometry does not silently change when catalog code ships */
  defVersion: number;
  params: Record<string, number | string | boolean>;
};
```

`Obj = PathObj | ShapeObj | ImageObj | MacroObj`

### MacroDef

```ts
type MacroParamSpec = {
  key: string;
  label: string;
  type: "number" | "enum" | "string" | "boolean";
  unit?: "mm";
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  default: number | string | boolean;
  /** If true, editing this field sets preset → "custom" (dimension fields) */
  breaksPreset?: boolean;
};

type MacroDef = {
  id: string;
  defVersion: number; // bump when expand geometry for this def changes
  name: string;
  category: "mount" | "display" | "control" | "panel";
  /** Short disclaimer shown in Properties */
  approxNote?: string;
  params: MacroParamSpec[];
  expand: (params: Record<string, number | string | boolean>) => PolylinePath[];
};
```

Catalog root: `export const CATALOG_VERSION = 1` plus `getMacroDef(id)`, `listMacroDefs()`.

### Persistence

- Macros live in `Document.objects`.
- On load: if `defId` unknown **or** `defVersion` not found for that def → **hard error state** for that object (see Missing def), not silent skip.
- Prefer not silently re-expanding with a newer `defVersion` than stored; either pin expand to stored version (if multiple expanders registered) **or** re-expand with current def but show a one-time warning “catalog updated; verify dimensions.” **v1 rule:** re-expand with current catalog code only when `defVersion` still matches; if app’s defVersion > stored, show **stale catalog** warning banner + still expand with current (user can re-save to bump). If defId missing entirely → missing-def error, no paths.

### Param validation

- Coerce types, clamp min/max, fill defaults for missing keys.
- Reject add with unknown `defId`.
- Boolean supported (e.g. `includeCornerHoles`).

### Preset vs custom (screen) — mandatory rule

For macros with a `preset` enum param:

1. Selecting a non-`custom` preset **overwrites** all dimension params from a fixed preset table in catalog code.
2. Editing any param marked `breaksPreset: true` (width, height, hole Ø, inset, etc.) sets `preset` to `"custom"`.
3. Selecting `custom` leaves current numbers as-is.
4. Agent `updateMacroParams` must apply the same rules after merge (validate in one function: `applyMacroParamUpdate(def, prev, partial)`).

---

## Workshop catalog

### v1 success set (must ship)

| defId | Name | Key params | Geometry |
| --- | --- | --- | --- |
| `panel` | Panel outline | `widthMm`, `heightMm`, `cornerRadiusMm`, `includeCornerHoles`, `holeDiameterMm`, `holeInsetMm`, `clearanceMm` | Outer path + optional 4 corner holes |
| `screen` | Screen / display | `preset`, `widthMm`, `heightMm`, `holeDiameterMm`, `holeInsetMm`, `clearanceMm` | **Opening only:** 1 rect cutout + 4 mount holes (not full module mechanical) |
| `mount-hole` | Mount hole | `diameterMm`, `clearanceMm` | 1 closed circle |
| `button` | Button | `diameterMm`, `clearanceMm` (default diameter 16) | 1 circle |

**Screen presets (v1):** at least `2.8-ili9341` (documented nominal dims) and `custom`. Treat dims as approximate openings.

### Hole diameter rule (clearance)

Cut radius uses:

```
cutDiameter = nominalDiameterMm + clearanceMm
```

- Default `clearanceMm = 0.2` on hole-like macros (mount, button, screen holes, panel corner holes).
- UI label: “Clearance (mm)” with helper text: “Added to nominal Ø so screws/modules fit.”
- User may set `0` for exact nominal (they own the risk).

### Stretch / post-v1 (not success criteria)

| defId | Notes |
| --- | --- |
| `mount-4hole` | Convenience pattern |
| `pot` | Shaft Ø + optional D-flat; **no** valueLabel geometry |
| `usb-c` | Mid-panel rounded slot only (edge-notch is known gap) |

Do not block workshop go-live on pot D-hole or USB.

---

## Geometry helpers

`core/macros/geomHelpers.ts`:

- `circleToPolyline(cx, cy, r, segments?)` — closed; default segments `max(24, ceil(r * 4))` so tiny holes are not hexagons.
- `roundedRectToPolyline` — for stretch USB.
- Screen cutout = axis-aligned rect polyline (opening only).

Local coords; instance transform applied in `expandMacro(obj)`.

---

## CAM integration

```ts
case "macro":
  return expandMacro(obj); // missing def → [] + warning already recorded by caller
```

### Rules (v1)

- One `layerId` → one Cut (line) operation for all expanded paths.
- Closed polylines only.
- Path ordering uses existing `insideOut` / etc.; **not guaranteed** for every topology — document as best-effort. Prefer defining expand order: holes first in array when useful, but do not claim CAM is a full mill strategy.
- **Missing / unexpandable macro:** `planCam` adds a **error-level or strong warning** and produces **no paths** for that object; UI shows the object in an error state so users do not cut a half panel silently.

### Preview / selection

- Render expanded polylines for valid macros.
- **Missing def:** dashed bbox placeholder + error badge in list; not invisible.
- Selection: union bbox of expanded geometry; click hits that macro id. Overlapping macros: **topmost in `document.objects` order** (last drawn wins). v1 accepts imperfect hit-test; no z-order tools yet.

---

## UI

### Document panel

- **+ Hardware** listing v1 defs (and stretch defs if implemented, marked optional).
- Object list: friendly name + short summary; error state if unexpandable.
- Disclaimer under Hardware: “Workshop approx — verify datasheet.”

### Place flow (v1) — cascade required

**Problem avoided:** stacking every part at (10, 10).

1. User picks a macro from Hardware.
2. `ObjectService.addMacro`:
   - Place on cut/line layer via `findOrCreateLayer(..., "line")`.
   - **Position:** cascade insert, not fixed origin:
     - Base: `(10, 10)`.
     - Each new macro: offset by `(15 * n, 15 * n)` where `n` = count of existing macros, **or** place at `(10 + 15 * n, 10)` in a row — pick **row cascade:** `e = 10 + n * 20`, `f = 10` (mm). If it would leave the bed, wrap to next row using machine bed width from profile when available, else wrap every 5 items.
   - Optional stretch later: click-to-place mode.
3. Store current `defVersion` from catalog.
4. `ADD_OBJECT` + `SELECT_OBJECT`.
5. Properties opens param form.

**Also in v1 (minimum spatial bar):** numeric X/Y in Properties (already exists for objects). Cascade makes first multi-part panel usable without drag.

**Still later:** click-to-place, drag, rotate UI, snap.

### Properties panel

When `kind === "macro"` and def resolves:

- X / Y, Layer
- Dynamic params from schema
- **Clearance** where applicable
- `approxNote` / global disclaimer
- Live regenerate on commit (see Undo)

When def missing: show error + defId + “Update Laseryx or remove object”; no silent empty params form pretending OK.

### Undo

- `UPDATE_OBJECT` already history-tracked.
- **Commit rule for numeric params:** apply on **blur** or Enter for number fields (or debounce ≥300ms), not every keystroke, so undoing diameter is one step. Enum/boolean can apply immediately.

---

## Agent / automation

| Command | Args | Result |
| --- | --- | --- |
| `macros.listDefs` | none | `{ defs: { id, name, category, defVersion, params: schema }[] }` |
| `document.addMacro` | `defId`, optional `params`, `x`, `y`, `layer`, `object` | MacroObj (uses cascade if x/y omitted) |
| `document.updateMacroParams` | `object`, `params` | MacroObj after `applyMacroParamUpdate` |

Reuse: `updateObjectTransform`, `setObjectLayer`, `deleteObject`.

Wire into capabilities / MCP next to `document.addRect`. Dry-run if siblings support it.

Agents **must** be able to discover schema via `macros.listDefs` so they do not invent defIds.

---

## Module layout

```
apps/pwa/src/core/macros/
  types.ts
  catalog.ts           # CATALOG_VERSION, defs, presets table, listMacroDefs
  expand.ts
  geomHelpers.ts
  validateParams.ts    # applyMacroParamUpdate, defaults, clamp
  place.ts             # nextCascadeTransform(document, bed?)

apps/pwa/src/core/model.ts
apps/pwa/src/core/cam.ts
apps/pwa/src/core/services/ObjectService.ts
apps/pwa/src/ui/components/preview/DesignView.tsx
apps/pwa/src/ui/panels/DocumentPanel.tsx
apps/pwa/src/ui/panels/PropertiesPanel.tsx
apps/pwa/src/automation/browser/documentCommands.ts
# + capability / MCP maps
```

---

## Testing

### Unit (required)

- Each **v1** def: expand defaults → path count + bbox asserts.
- Screen: 1 rect + 4 holes; preset apply overwrites dims; editing width → `preset === "custom"`.
- `cutDiameter = nominal + clearance` reflected in geometry.
- Cascade: second addMacro not same transform as first.
- Missing defId / unexpandable: expand returns [] and planCam warns; no throw.
- `validateParams` / `applyMacroParamUpdate` edge cases.

### Golden (required for v1)

- One fixture document: panel + screen + mount-hole + button → golden G-code (or plan polyline snapshot if gcode too brittle). **Not optional.**

### Integration / automation

- addMacro + reducer persists `kind`, `defVersion`.
- `macros.listDefs` returns v1 ids.
- `document.addMacro` / `updateMacroParams` happy path; unknown defId errors cleanly.
- Project save/load round-trip of MacroObj fields.

---

## Success criteria (workshop v1)

1. User places **panel**, **screen**, **mount-hole**, and **button** from Hardware without SVG import; parts are **not stacked** on one point (cascade).
2. Screen preset change rewrites dims; editing a dimension sets preset to `custom`; hole/button Ø includes **clearance**.
3. Generate G-code + preview show all macro paths; streamable on existing GRBL path; **mandatory golden** for the four-part sample.
4. Agent: `macros.listDefs` + `document.addMacro` + `updateMacroParams` for a screen.
5. UI shows workshop-approx disclaimer; missing def is a visible error, not a silent hole in the cut.

---

## Implementation order

1. Types, geom helpers, validateParams (preset rules), place cascade, expand + **panel / screen / mount-hole / button** + cam branch + unit tests  
2. ObjectService + Hardware menu + DesignView render / error state / select  
3. Properties (params + clearance + blur commit) + disclaimer  
4. Agent: listDefs, addMacro, updateMacroParams + MCP/capabilities  
5. **Golden** four-part fixture  
6. Stretch only if time: mount-4hole, pot, usb-c  

---

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Users trust wrong footprints | Approx disclaimer in UI + docs; success is “workshop”, not aerospace |
| Stacked parts | Cascade place required in v1 |
| Silent wrong geometry after catalog change | `defVersion` + stale/missing handling |
| Screws don’t fit | Default `clearanceMm = 0.2` |
| SVG import still faster | Cascade + 4 solid macros first; don’t dilute into 7 half-done parts |
| Undo spam | Blur/debounce param commits |
| insideOut not perfect | Don’t over-claim; holes-first array order where easy |

---

## Known gaps (accepted; do not block v1)

| Gap | Notes |
| --- | --- |
| No click-to-place / drag / rotate UI | Cascade + numeric X/Y only |
| No multi-layer cut+engrave macros | Labels not cut/engraved from params |
| No pot valueLabel geometry | Avoid fake “resistance on panel” |
| USB edge-notch / enclosure thickness | Stretch mid-panel slot only if built |
| No kerf compensation beyond clearance param | Clearance is the v1 fit tool |
| Hit-test / z-order tools | Last-in-document wins; refine later |
| Full FPD library (D-holes standards, rack holes, standoffs) | Out of scope |
| Pin multiple expand implementations per defVersion forever | v1 warns on stale; may re-expand with current code |

---

## Open decisions (resolved for v1)

- **Approach:** parametric macros (not explode-only templates).  
- **Place:** **cascade insert** (required); click-to-place later.  
- **v1 catalog:** panel, screen, mount-hole, button only for success.  
- **Clearance:** default 0.2 mm on hole-like cuts.  
- **Preset rule:** preset overwrites dims; dim edit → `custom`.  
- **Catalog identity:** store `defVersion`; missing def = hard error UI.  
- **Engrave / multi-op / live electronics:** out of scope.  
- **Golden test:** required for four-part sample.
