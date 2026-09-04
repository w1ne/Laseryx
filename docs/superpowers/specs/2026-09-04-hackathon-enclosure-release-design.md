# Hackathon Enclosure Release — Design

**Date:** 2026-09-04  
**Status:** Approved direction, frozen for implementation review  
**Product:** Laseryx  
**Event:** Budapest Hardware Club — Agent Control Deck Hackathon, 2026-09-09

## Goal

Make Laseryx the fastest safe path from a control-panel idea to a cut-ready, press-fit desktop console using the exact hackathon kit and A5 wooden sheets. A participant should be able to place supplied components, dimension the front panel, generate a constrained enclosure, arrange it automatically on sheets, verify it, and cut it within minutes.

## Release boundary

This release includes:

- one reconciled trunk named `main`;
- the current editor, macro, sketch-dimension, CAM, and agent work;
- exact built-in presets for the supplied HESTORE kit;
- a sloped desktop-console enclosure with constrained panels;
- an editable 3.0 mm material default and fit-calibration coupon;
- A5 sheet objects, automatic packing, and manual adjustment;
- enclosure-aware preflight, save/load, undo/redo, and agent commands;
- a release-candidate validation pass and tagged production deployment.

This release does not include:

- the dangling hosted Cloudflare/OAuth implementation chain, which must be preserved and handled in a separate PR;
- arbitrary user-authored component definitions;
- a generic family of box/enclosure shapes;
- a 3D solid-modeling kernel;
- automatic wiring, PCB layout, or firmware generation;
- glue-dependent construction.

## Repository and release recovery

The repository currently has split history:

- `develop` contains the hardware macros, template library, canvas editing, constrained sketch engine, and the two latest editor fixes;
- `master` contains sixteen layer/material agent commits absent from `develop`;
- production is commit `625c3d3`, older than both branches;
- the Pages workflow deploys only `v*` tags or manual dispatches;
- seventeen unreferenced cloud/auth commits beginning at `2c4e8ee` and ending at `c85d57f` are outside this release.

Implementation starts by creating a reconciliation branch, preserving the cloud/auth chain on a named recovery branch, merging the two active histories without dropping either feature set, and proving all existing tests/builds pass. The reconciled history becomes `main`; GitHub's default branch and CI targets become `main`. Old `master` and `develop` branches are removed only after remote `main`, CI, and release-candidate validation succeed.

Production remains tag-driven. A release candidate is manually deployed and smoke-tested before a new version tag is created from `main`.

## User workflow

1. Start a new project or open an existing front-panel project.
2. Open **Kit Parts** and drag exact supplied components onto the front panel.
3. Edit a preset's dimensions or clearance when measured hardware differs.
4. Use the existing dimension tool and constraints to locate components relative to panel edges and one another.
5. Choose **Make Enclosure**.
6. Set console depth, rear height/front angle, material thickness, kerf, joint fit, finger width, sheet margin, and part spacing. Defaults are usable immediately.
7. Generate a small fit coupon first. Cut it, select the best-fitting slot, and update the fit value.
8. Preview the constrained six-panel console and resolve keep-out or size warnings.
9. Generate the enclosure. Laseryx creates named panel parts and automatically packs them across as many A5 sheets as required.
10. Drag or rotate individual panels if desired. This changes sheet placement only, never panel dimensions.
11. Run preflight. Laseryx blocks cutting on invalid geometry, overlaps, out-of-sheet parts, missing operations, or stale/unsolved definitions.
12. Preview toolpaths and cut through the existing CAM → G-code → GRBL workflow.

The primary call to action is progressive: **Add kit parts → Make enclosure → Calibrate fit → Arrange sheets → Preflight & cut**. Advanced parameters remain collapsed until requested.

## Exact kit catalog

The built-in catalog is intentionally limited to the supplied kit. Each definition stores the HESTORE SKU, display name, source URL, definition version, editable parameter schema, physical body envelope, front-panel geometry, mounting geometry, protrusion, rear keep-out, and confidence/source note.

| SKU | Definition | Default panel behavior |
| --- | --- | --- |
| `100.491.54` | `IPS-1.9-ST7789-SPI-M` | Display window plus editable mounting holes; board 62 × 29 mm; visible window 43.72 × 23.695 mm |
| `100.355.72` | `ROT-1AB` | Editable Ø6 mm shaft opening, optional anti-rotation/mount features, rear module keep-out |
| `100.220.17` | `KNX1 / MTS-102` | Editable Ø6 mm mounting hole; body keep-out 12.5 × 6.5 × 9.5 mm |
| `100.321.00` | `CDE23N-60-B10K` | Editable 60 mm slider slot plus mounting holes; body keep-out 88 × 12.5 × 11 mm |
| `100.519.82` | `TACTS-12MOD-4CH` | Four button-cap openings plus editable board mounting holes and rear keep-out |
| `100.431.82` | `INMP441-M` | Internal component by default; optional acoustic port, board mounts, and keep-out |
| `100.357.19` | `RC-40-20/FF` | BOM-only cable entry with no cut geometry |

The distributor page alone does not provide every board-hole coordinate. Defaults without a reliable mechanical drawing must be marked **measure/verify**, remain editable, and cannot claim datasheet precision. Physical caliper measurements of the delivered modules become the authoritative preset values before the event release.

## Parametric architecture

The approved architecture is fully constrained panel geometry with independent placement transforms.

### Parametric part

A `ParametricPart` is a document object containing:

- identity, name, layer, definition ID/version, and optional assembly ID;
- a local `SketchDocument` with points, entities, constraints, and named parameters;
- a placement transform used only to position/rotate the solved part on the laser bed or sheet;
- semantic features such as `outer-profile`, `component-opening`, `mount-hole`, `joint-tab`, `joint-slot`, `engrave-label`, and `construction`;
- solve status, definition warnings, and source metadata.

Local sketch coordinates isolate design intent from nesting. Editing a dimensional constraint changes the part. Dragging or rotating the part changes only its placement transform.

Existing loose shapes/macros remain supported and require no migration. The old macro expander and new parametric-part solver share the same final `PolylinePath[]` boundary consumed by preview and CAM.

### Component definition and instance

A versioned `ComponentDef` produces a local constrained feature sketch and keep-out envelope. A placed `ComponentInstance` retains:

- `defId` and `defVersion`;
- source SKU/URL;
- resolved parameter values;
- a transform relative to its owning panel;
- mounting mode and optional acoustic/opening behavior.

Editing a preset parameter marks the instance as customized without severing its definition identity. Updating catalog code never silently changes an existing document: version mismatch produces a visible stale-definition warning and requires explicit upgrade/revalidation.

### Enclosure assembly

One `EnclosureAssembly` owns shared named parameters and six generated `ParametricPart` children:

- sloped front panel;
- rear panel;
- left and right side cheeks;
- base;
- removable service lid/top panel.

Shared parameters include external width, depth, front height, rear height, front angle, material thickness, kerf, fit clearance, nominal finger width, minimum edge margin, and service-lid retention mode. The wizard derives a consistent parameter set; users do not enter redundant angle/height combinations.

Each joined edge is represented once as a semantic `JointDef`, then projected into complementary tab and slot features on its two panels. This prevents mismatched joint counts or spacing. Joint generation centers an odd number of fingers where possible, enforces minimum corner material, compensates cutting geometry for kerf, and applies fit clearance to slot width.

The service lid is removable without glue. Other edges use press-fit tab/slot joints. The first release uses one proven retention pattern only; it does not expose interchangeable joint families.

### Solve and expansion flow

1. Validate definition IDs, versions, and numeric parameter ranges.
2. Resolve assembly parameters and paired joint definitions.
3. Build/update each local constrained sketch.
4. Solve the sketch and retain structured status (`ok`, residual, degrees of freedom, message).
5. Convert semantic cut features to closed polylines; omit construction/keep-out geometry from CAM.
6. Apply the part placement transform.
7. Feed paths to the existing preview, hit-testing, CAM planning, optimization, G-code, and GRBL layers.

An unsolved or unknown part produces no cut path and an error-level preflight finding. Laseryx never silently cuts a partial enclosure.

## Front-panel ownership and editing

The selected front panel becomes the enclosure's front-panel part. Component instances remain children of that panel and retain semantic identity in the object list. Users can:

- select/move a component within the panel;
- dimension its center, edge, or mounting feature against panel geometry;
- edit preset dimensions and clearance in Properties;
- rotate, duplicate, hide, lock, or remove it;
- see its cut geometry, board outline, protrusion, and rear keep-out in distinct preview styles.

The solver validates that cut openings remain inside the panel and that keep-outs do not intersect enclosure walls, other keep-outs, or joint zones. Visual warnings appear before the wizard can finalize the enclosure.

## Fit calibration

Default material thickness is 3.0 mm and remains editable. Because nominal plywood thickness and laser kerf vary, the wizard prominently offers **Generate fit test**.

The coupon contains labeled slots centered around the current effective slot width, for example five variants at −0.20, −0.10, 0.00, +0.10, and +0.20 mm fit offsets. Labels use an engrave layer when available; geometry remains identifiable without engraving by ordered marks. The user selects the best result and Laseryx stores the chosen material thickness, kerf, and fit clearance in the project/enclosure.

The enclosure may be previewed before calibration, but production preflight warns when the fit is uncalibrated. The warning is explicitly overridable; it is not a hard block.

## Sheet model and automatic packing

An A5 sheet is a first-class non-cutting layout region with default dimensions 210 × 148 mm, editable margin, quantity, material preset, thickness, and grain-direction metadata. Sheet outlines are never emitted as cut geometry.

Packing operates on solved part bounds plus configured spacing:

- try 0° and 90° rotations unless grain lock forbids rotation;
- place larger parts first using a deterministic bottom-left strategy;
- create additional A5 sheets as required;
- keep the fit coupon on the first sheet when it fits;
- preserve stable part placement across regeneration when the new geometry still fits;
- allow users to drag/rotate parts after packing;
- offer **Repack all** as an explicit destructive-layout action with undo support.

The first release does not promise globally optimal nesting or arbitrary polygon interlocking. Deterministic rectangle packing is preferred because it is fast, explainable, and reliable during a workshop.

## UI structure

### Kit Parts

The current searchable template library gains a **Hackathon Kit** category with a compact card for each mounted component and internal/BOM entries clearly distinguished. Dragging or clicking a card places one instance and opens Properties. Cards display SKU and a short mounting summary.

### Properties

Properties shows common transforms first, then preset-specific fields grouped as Opening, Mounting, Body/keep-out, and Source. Numeric edits commit on Enter/blur so undo remains one meaningful action. A customized badge appears after changing preset dimensions; **Reset to measured preset** restores defaults.

### Make Enclosure wizard

The wizard has three focused steps:

1. **Panel check:** choose/confirm the front panel and resolve component/joint-zone collisions.
2. **Box & fit:** choose console dimensions and material; generate/select calibration fit.
3. **Sheets:** preview six constrained panels and A5 count, then generate and pack.

Advanced geometry fields are collapsed. Every step shows a live 2D preview and plain-language validation. Cancel makes no document changes. Finish is one undoable transaction.

### Object tree

The object list represents hierarchy:

```text
Agent Console
├── Front Panel
│   ├── Display
│   ├── Rotary Encoder
│   ├── Toggle Switch
│   ├── Slider
│   └── Four Buttons
├── Rear Panel
├── Left Side
├── Right Side
├── Base
└── Service Lid
A5 Sheet 1
A5 Sheet 2
```

Selecting an assembly edits shared enclosure parameters; selecting a panel edits local constraints/placement; selecting a component edits mounting parameters and front-panel position.

## State, history, and persistence

All creation and regeneration use normal typed reducer actions. Finishing the wizard is one history transaction. Parameter edits are atomic transactions. Packing and repacking are separate undoable transactions.

The document schema version is bumped and migration is additive. Existing projects load unchanged. New objects retain definition versions and source metadata. Export/import and IndexedDB save/load must round-trip the complete assembly, nested parts, component instances, sheet layout, and calibration state.

## Agent automation

The browser-owned application protocol remains authoritative. New discoverable commands cover the same workflow as the UI:

- `components.listDefs`
- `document.addComponent`
- `document.updateComponent`
- `enclosure.createSlopedConsole`
- `enclosure.get`
- `enclosure.update`
- `enclosure.generateFitCoupon`
- `sheets.createA5`
- `sheets.pack`
- `preflight.run`

Commands validate schemas, return structured IDs/status/warnings, support dry-run where sibling mutation commands do, and dispatch the same reducer/application services used by the UI. No separate agent-only geometry path is introduced.

## Validation and errors

Preflight blocks generation/cutting for:

- unknown or stale definitions not explicitly upgraded;
- unsolved or over-constrained sketches;
- open or self-intersecting cut paths;
- component openings outside the front panel;
- keep-out collisions with walls, joints, or other modules;
- tab/slot mismatch or a joint below minimum material limits;
- parts overlapping on a sheet;
- cut geometry outside every sheet;
- sheet/material thickness mismatch;
- missing cut operation or invalid CAM settings.

Preflight warns, but permits explicit override, for:

- fit coupon not calibrated;
- mechanically approximate preset values;
- unused/internal components without mount geometry;
- inefficient packing or additional sheet use;
- engrave labels without an engrave operation.

Every finding includes severity, object IDs, a concise explanation, and a suggested correction. Relevant UI selections focus the affected object.

## Verification strategy

### Automated

- Unit-test every component definition's default parameters, path count, bounds, keep-out, customization, and stale-version behavior.
- Unit-test sloped-console parameter derivation and all paired joints across representative sizes, material thicknesses, kerf, and fit values.
- Property-test joint complementarity and closed/non-self-intersecting profiles over bounded parameter ranges.
- Unit-test coupon variants and label ordering.
- Unit-test deterministic A5 packing, rotation, added-sheet behavior, stable regeneration, overlap detection, and out-of-sheet detection.
- Test document migration and export/import round trips.
- Test reducer/history transactions for wizard finish, regeneration, packing, and undo/redo.
- Test UI workflow from kit placement through preflight using realistic project fixtures.
- Test automation command discovery, validation, dry-run, execution, and browser bridge routing.
- Add a golden fixture for the complete supplied-kit console and compare solved polylines plus generated G-code.
- Run lint, all tests, PWA build, CLI build, local MCP build, and hosted-MCP build.

### Physical

- Measure all delivered mounted components with calipers and update/confirm authoritative preset values.
- Cut the fit coupon from the actual A5 stock on the event laser and record the chosen fit.
- Cut and assemble one full reference enclosure without glue.
- Verify every supplied component can be installed and removed without damaging the panel.
- Verify rear clearance, wiring access, USB access, slider travel, control actuation, and display visibility.
- Run one complete browser-to-G-code-to-machine job and inspect cut order and sheet boundaries.

### Release

- Reconcile into `main` and require clean CI.
- Deploy a release candidate manually from the exact candidate SHA.
- Smoke-test project create/save/load, component placement, dimensions, wizard, packing, preflight, G-code preview, and virtual-machine streaming on the deployed URL.
- Confirm the deployed About/version metadata matches the candidate SHA.
- Create and push the production version tag from that same SHA.
- Confirm Pages deployment success, `https://laseryx.com/` HTTP health, bundle reachability, version metadata, and the full critical workflow in production.

## Success criteria

The release is complete only when:

1. `main` contains both active branch histories and is the sole development trunk.
2. The cloud/auth chain is preserved outside the hackathon release.
3. A user can place every relevant supplied module without importing SVG.
4. Module openings, mounts, clearances, protrusions, and keep-outs remain editable and dimensionable.
5. A user can turn a dimensioned front panel into a constrained, press-fit sloped console through the wizard.
6. All six panels have matching joints and can be moved independently for layout without changing their internal geometry.
7. Laseryx generates a fit coupon and stores the selected fit.
8. Laseryx automatically packs the console across A5 sheets and permits manual adjustment.
9. Preflight detects unsafe/incomplete enclosure and sheet states before cutting.
10. The full document survives save/load/export/import and supports undo/redo.
11. Agents can discover and drive the same component, enclosure, sheet, and preflight workflow.
12. Automated verification passes and a physical reference console is cut and assembled without glue.
13. The tagged build containing this functionality is verified live at `laseryx.com`.

