# Fabrication-ready enclosures

## Objective

Make the generic Components & Box workflow reliable enough to take a measured component layout through a tilted, six-face, laser-cuttable enclosure without silently inventing mechanical dimensions. The workflow remains simple for hackathon use while supporting arbitrary future hardware.

## User workflow

The primary journey remains **Components -> Panel -> Make Box -> Sheets -> Cut**.

1. Create the source control panel.
2. Place verified library components or measured custom components.
3. Resolve every required measurement shown by component readiness.
4. Enter the stock thickness and desired fit clearance.
5. Set front and rear heights. Different heights produce a tilted panel; Laseryx derives the depth from the source-panel slope length.
6. Generate all six finger-jointed faces and arrange them on construction sheets.
7. Complete fabrication preflight and export/cut.

The default view stays concise. Detailed dimensions, mounting geometry, sources, confidence, sheet settings, and fit controls live under progressive disclosure.

## Component definitions

A component definition separates five mechanical concepts:

- **Panel cutout:** one or more circles, slots, rectangles, rounded rectangles, or repeated holes removed from the panel.
- **Mounting holes:** positioned holes with diameters and optional countersink notes.
- **Body envelope:** the volume behind the panel used to detect insufficient enclosure clearance.
- **Front protrusion:** the controls, bezel, or shaft extending above the panel.
- **Metadata:** vendor, SKU, part number, source URL, source type, notes, and confidence.

Every dimension is editable in a user copy. Bundled definitions remain immutable examples so user corrections survive application upgrades.

Confidence is explicit:

- `verified`: supported by a product-specific mechanical drawing or vendor specification.
- `measured`: entered from the physical item by the user.
- `nominal`: useful product information that is not sufficient for fabrication.
- `required`: missing and blocks fabrication readiness when relevant to mounting.

The bundled HESTORE definitions cover the seven purchased items. The ribbon cable remains internal-only. The microphone defaults to internal mounting with a configurable acoustic opening. The four-button module and any undocumented mounting geometry remain measurement-required until real values are entered. Laseryx must never turn a nominal electrical datasheet for a bare IC into verified carrier-board geometry.

## Fit settings

The box settings keep two direct, editable inputs:

- stock thickness;
- fit clearance.

The existing optional coupon remains available and contains multiple labelled candidate clearances around the requested value. A user may cut it using the intended material and settings, then enter the preferred clearance directly.

This release does not store machines, material profiles, calibration history, or coupon confirmation. The application warns that these values should be physically checked but does not block export solely because a coupon was not tested.

## Enclosure geometry

The exact source panel remains the sloped top/control face. Front and rear heights define its rise; its existing height is the slope length. Laseryx derives horizontal depth using the Pythagorean relationship and rejects impossible combinations where the rise is not smaller than the slope length.

Generation produces the source panel, front, rear, left, right, base, and removable service panel as closed, non-self-intersecting contours. Joint geometry uses the entered thickness and fit clearance. Side faces represent the requested tilt, and component body envelopes are checked against available internal depth and neighbouring bodies.

Regeneration preserves valid manual sheet placements and invalidates stale geometry. Sheet boundaries remain construction-only and never enter the cut toolpath.

## Readiness and error handling

Fabrication preflight uses blocking errors for:

- missing required component dimensions;
- component cutouts outside the source panel or intersecting forbidden joint zones;
- overlapping cutouts or body envelopes where they cannot coexist;
- insufficient internal clearance for a component body;
- impossible tilt dimensions or joint geometry;
- open, invalid, or self-intersecting contours;
- parts outside, overlapping on, or too large for configured sheets;
- invalid stock thickness or fit clearance.

Warnings cover non-blocking nominal data, front-protrusion notes, internal cable/acoustic-routing reminders, and the recommendation to test a coupon for a new material or machine setup. Each issue names the affected component or face and provides a direct corrective action.

## Persistence and compatibility

Workspace persistence gains versioned component definitions. Loading older workspaces migrates existing primitive presets into the new definition structure without changing their cut geometry. Malformed or unsupported stored data is sanitized and reported rather than crashing the editor.

Undo/redo covers component edits, box generation, and sheet arrangement. User presets remain local-first and require no account.

## Verification

Automated tests cover:

- component-schema validation, migration, sanitization, copying, and persistence;
- each HESTORE definition and its confidence/source classification;
- compound cutouts and mounting-hole transforms;
- body-envelope clearance checks;
- optional coupon generation and labelled candidate clearances;
- flat and tilted box geometry, joint fit parameters, contour validity, and impossible dimensions;
- preflight blockers and actionable messages;
- sheet packing, construction-layer exclusion, authoritative toolpath geometry, and undo/redo;
- the complete UI journey with concise defaults and advanced editing.

The release gate is a fresh lint, full test suite, all production/CLI/MCP builds, and deployed-site smoke check. Physical completion additionally requires cutting one coupon and dry-assembling one enclosure from the intended stock; the application records these steps but cannot perform them.

## Scope boundaries

This release does not attempt arbitrary 3D CAD, automatic interpretation of unknown PDFs, camera-based measurement, structural simulation, or remote control of an unspecified laser. It provides deterministic parametric enclosure generation from explicit, traceable mechanical inputs.
