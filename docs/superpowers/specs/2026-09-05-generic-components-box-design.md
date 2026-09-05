# Generic Components & Box Design

## Goal

Replace the hackathon-specific enclosure panel with a simple, generic workflow that lets anyone define reusable cutout components, arrange them inside a real panel, transform that panel into a complete press-fit enclosure, arrange the resulting parts on physical sheets, and cut them.

The primary journey is:

**Components → Panel → Make Box → Sheets → Cut**

## Product principles

- The default interface exposes only decisions required to produce a box.
- Components are generic cut geometry, not vendor-specific electronics records.
- The panel on the canvas is the source face of the enclosure.
- Making a box consumes that panel and preserves its openings.
- Generated parts are normal editable canvas entities grouped by enclosure and sheet.
- Manufacturing parameters remain available under **Advanced**.
- Bundled hardware is example content, not application architecture.

## Primary interface

The left rail contains one **Components & Box** section with four sequential actions:

1. **Add component**
2. **Create/edit panel**
3. **Make box**
4. **Arrange sheets**

Only the action relevant to the current state is emphasized. Each action shows a short result summary, not a technical form.

### Add component

The default component types are:

- Circle
- Slot
- Rectangle
- Rounded rectangle
- Button row

The user chooses a type, enters a name and its minimum dimensions, and can save it as a reusable preset. Selecting a bundled preset fills the same form. The existing HESTORE hackathon modules ship as examples under **Example presets** and have no special behavior.

For a button row, the minimum dimensions are button diameter, button count, and center-to-center pitch. For a slot, they are length and width. For a rectangle or rounded rectangle, they are width and height, plus optional corner radius. For a circle, it is diameter.

Editing a preset changes future placements only. Editing a placed component changes that instance only.

### Create/edit panel

A panel is a first-class model with:

- stable ID and name;
- width and height;
- local component instances;
- its own canvas placement transform.

Component positions are stored in panel-local coordinates. The panel renders as one outline plus its owned cutouts. Moving the panel moves all its openings. Moving a component changes only its local position.

The default panel is 160 × 100 mm. Width and height remain directly editable.

### Make box

**Make box** opens a compact confirmation showing overall width, depth, front height, rear height, and estimated sheet count. The default is a sloped desktop console.

Generation uses the existing panel as the enclosure’s front/top face. Its outline receives the required edge joints while every component cutout remains at the same local position. The generator adds five faces:

- rear;
- left;
- right;
- base;
- removable service panel.

Together with the source panel, these are a complete six-face enclosure. Adjacent edges use deterministic complementary finger patterns. Joint depth derives from material thickness. Clearance adjusts mating geometry rather than scaling whole panels.

The normal form exposes only depth, front height, and rear height. **Advanced** contains:

- material thickness, default 3.0 mm;
- fit clearance, default 0.15 mm;
- target finger width, default 8 mm;
- sheet size and gap;
- calibration coupon inclusion.

### Arrange sheets

Sheets are explicit visible canvas entities. The default is A5 landscape or portrait, 210 × 148 mm, with 5 mm margin and 3 mm inter-part gap.

Automatic packing places enclosure parts without modifying their local geometry. Users may move or rotate packed parts manually. Regeneration preserves manual transforms for parts whose stable IDs survive. **Arrange sheets** may be run again explicitly to discard manual placements and repack.

## Model boundaries

### ComponentPreset

Stores a stable ID, name, primitive type, editable dimension schema, dimension values, and optional example/source metadata.

### ComponentInstance

Stores a stable ID, preset ID, copied dimension values, and panel-local transform. It is independent after placement.

### PanelDesign

Stores the panel dimensions, component instances, and canvas transform. It expands deterministically into one closed outline plus closed cutout paths.

### EnclosureDesign

Stores source panel ID, box parameters, six stable panel records, coupon state, and generation revision. The source panel remains authoritative.

### SheetLayout

Stores sheet dimensions, margins, gaps, and placements keyed by stable part IDs. Placement transforms are separate from parametric geometry.

The saved project model includes these records in a versioned optional workspace section. Existing projects without this section continue loading unchanged.

## Regeneration

Regeneration follows one path:

1. Validate component dimensions and panel containment.
2. Expand the source panel and its owned cutouts.
3. Generate complementary joints and the other five faces.
4. Reuse existing sheet transforms by stable part ID.
5. Place new or resized parts that no longer fit into an unplaced queue.
6. Run enclosure preflight.

This prevents sheet placement from fighting dimensional constraints and ensures component openings are never detached from the source panel.

## Validation and error handling

Box generation is blocked when:

- a dimension is non-finite or not positive;
- a cutout crosses the usable panel boundary;
- two owned cutouts overlap when overlap is disallowed;
- an edge is too short for a valid finger pattern;
- a generated contour is open or self-intersecting;
- a part cannot fit the selected sheet in either orientation.

Preflight also reports:

- sheet overlaps or out-of-bounds placements;
- material/profile thickness mismatch;
- unconfirmed calibration coupon;
- low-confidence dimensions from bundled examples.

Messages name the affected component or panel and state the corrective action. The interface does not expose internal error codes.

## Persistence and history

Creating, placing, editing, deleting, generating, regenerating, and packing are atomic undoable actions. Saving and reopening a project preserves presets used by that project, component instances, box parameters, generated panels, and manual sheet transforms.

User-created reusable presets are stored locally in a separate preset repository. Deleting a preset never deletes existing instances.

## Verification

Pure unit tests cover:

- every primitive expansion;
- preset-copy semantics;
- panel-local transforms;
- containment and overlap validation;
- preservation of cutouts in the enclosure source face;
- six-face generation and complementary edge patterns;
- deterministic packing and transform preservation;
- save/load and undo/redo.

UI tests cover the four-step progressive interface and Advanced disclosure. A browser workflow verifies creating a custom component, placing it in a panel, generating a full box, arranging A5 sheets, saving/reloading, and reaching preflight-ready status.

The final production tag remains gated by cutting the calibration coupon and dry-assembling one enclosure with the actual laser and stock.
