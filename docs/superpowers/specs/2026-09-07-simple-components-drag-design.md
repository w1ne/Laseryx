# Simple Component Editing and Freehand Dragging

## Goal

Make panel composition understandable during a hackathon: place a component, resize it when applicable, and drag it freely to the desired position on the front panel.

## User interface

- Remove the Mechanical details section from both the preset creator and placed-component editor.
- Do not expose confidence, missing-measurement lists, source provenance, acoustic holes, front protrusion, mechanical notes, or coordinate-list inputs.
- Show only the component's ordinary size fields and X/Y position in the form.
- Preset cards may show a short readiness message, but must not expose engineering terminology.

## Cut geometry

- A component creates only its primary opening: circle, slot, rectangle, rounded rectangle, or button-row openings.
- Do not generate component mounting holes or acoustic holes, including holes stored in bundled presets or older saved projects.
- Retain body-envelope and measurement metadata in the data model for compatibility and internal clearance/readiness checks. Removing confusing controls must not silently make an unsafe enclosure fabrication-ready.

## Direct manipulation

- A component on the source front panel can be moved with pointer or mouse drag.
- Dragging is freehand: no grid, center, edge, or neighbor snapping.
- Clamp the final position so the complete primary cutout stays inside the panel.
- Show movement continuously while dragging.
- Commit the completed drag through the enclosure-workspace update path as one undoable history action.
- Regenerate derived box geometry through the existing workspace flow so generated front-panel geometry stays synchronized.
- Dragging applies to the editable source front panel, not to generated box faces or arranged sheet copies.

## Error behavior

- If a component is too large to fit inside the panel, preserve the current design and surface the existing validation error rather than producing invalid geometry.
- Cancelling or losing a drag before movement must not create a history entry.

## Verification

- UI tests prove the engineering fields and mounting-hole syntax are absent.
- Geometry tests prove stored mounting and acoustic holes are not expanded into cuts.
- Interaction tests prove freehand movement, boundary clamping, one history update, and synchronized rendered geometry.
- Run the full test, lint, and production-build suites before merge and deployment.
