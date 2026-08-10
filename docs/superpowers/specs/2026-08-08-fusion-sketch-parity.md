# Fusion sketch parity (what we copy vs not)

**Source:** Autodesk Fusion sketch environment (app installed locally) + Autodesk sketch docs.

## Fusion drafting model (target UX)

1. **Pick a sketch tool** (Line, Rectangle, Circle, …) — tool stays active.
2. **Drag / click on the plane** to create geometry.
3. **Dimensions** control size (edit in UI or on-canvas).
4. **Construction** is a **property** (toggle; dashed orange) — not a separate tool.
5. **Constraints** (horizontal, coincident, equal, …) fully define the sketch.
6. **Parameters** link named dimensions for parametric updates.

## Laseryx mapping (laser 2D, not 3D CAD)

| Fusion | Laseryx now |
| --- | --- |
| Sketch tools palette | Left tool strip: Select, Rect, Circle, Line, Slot, Round rect, Import |
| Drag to create | Active tool + drag on bed with live size ghost |
| Tool stays active | Yes (after draw stays on tool; Esc → Select) |
| Construction property | Properties checkbox + **X** shortcut; orange dashed |
| Dimensions | Properties panel + on-canvas size label on selection |
| Mirror / rotate | Properties → Transform |
| Constraints solver | **Not planned** (no geometric constraint engine) |
| Full parameter table / formulas | **Not yet** (direct numeric fields only) |
| 3D / extrude / timelines | Out of scope (laser CAM) |

## Honest limit

We copy Fusion’s **drafting interaction**, not the **parametric constraint kernel**. Building a full constraint solver is a separate product (CAD kernel work). For laser panels, tool + drag + dimensions + construction is the high-value subset.
