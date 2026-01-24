# File: docs/roadmap.md

# Roadmap (reduced complexity, no WASM)

Milestone 0 — Scaffolding
Goal: PWA runs, worker runs, tests run.

Deliverables
- Vite + React + TS app under apps/pwa
- PWA manifest + service worker (offline app shell)
- Web Worker wired with worker.ping
- Test runner (Vitest) configured

Acceptance
- `npm run dev` works
- `npm run build` works
- `npm test` works
- UI shows "pong" from worker

Milestone 1 — Vector-only export (first usable output)
Goal: create a simple vector job and export deterministic G-code.

Deliverables
- Minimal editor:
  - create rectangle and move/scale (can be numeric inputs first)
  - layer + operation assignment panel (single op is enough)
- Worker core:
  - cam planning for polylines (rect -> polyline)
  - gcode emission with speed/power/passes
- Export:
  - download .gcode file
- Golden tests:
  - at least 5 fixtures with expected G-code outputs

Acceptance
- On Linux Chromium: create rectangle -> export G-code -> file downloads
- Golden tests pass

Milestone 2 — Web Serial control (GRBL, ack streaming)
Goal: run exported job directly from the PWA on Linux.

Deliverables
- Machine tab:
  - connect/disconnect
  - status (poll)
  - start/abort/pause/resume
- Streaming:
  - ack mode implemented and reliable
- Safety:
  - "Arm Laser" gate before streaming

Acceptance
- Documented smoke test procedure on a real GRBL device
- Simulated controller test covers ok/error and abort path

Milestone 3 — Raster engraving MVP (correctness first)
Goal: bitmap import and raster toolpath generation (may be slow).

Deliverables
- Bitmap import
- Raster op:
  - line step, speed, max power
  - threshold dithering + one error diffusion
- Golden tests for raster plan + G-code

Acceptance
- Bitmap -> raster preview -> export works, deterministic outputs

Milestone 4 — SVG Import (Vector Support)
- Import external vector designs (SVG)
- Convert basic SVG shapes to toolpaths
- Unified import workflow for Raster (Image) and Vector (SVG)

Milestone 5 — Project Persistence (Save/Load)
Goal: Users can save their work and come back later.
Deliverables:
- IndexedDB storage layer.
- Save/Load/New Project UI actions.
- Persistence of Document (Vectors), Images (Blobs), and Settings.
Acceptance:
- Create design with Image + Vector -> Save -> Refresh Page -> Open -> Design restored exactly.

Milestone 6 — Advanced Machine Control (Released)
Goal: Full control over machine position and state.
Deliverables:
- Jog Controls (X/Y arrows) using GRBL `$J` jogging.
- Homing (`$H`) and Unlock (`$X`) buttons.
- Zeroing ("Set Zero" for Work Coordinate System).
- Digital Readout (DRO) for Work and Machine coordinates.

Milestone 7 — UI Refactoring & UX Simplification (Released)
Goal: Make the interface logical, simple, and scalable.
Deliverables:
- Split monolithic `App.tsx` into focused panels (`DocumentPanel`, `PropertiesPanel`, `LayersPanel`).
- logical grouping: "Add/Import" belongs to Document; "Layer Assignment" belongs to Properties.
- Clean separation of concern: Design State vs Machine State.
Acceptance:
- User can intuitively find "Import".
- User can easily move objects between layers.
- Codebase is modular (no 1000+ line App.tsx).

Milestone 8 — Code Refactoring & Optimization (Released)
Goal: Modularize logic, reduce repetition, and implement proper state management.
Deliverables:
- Centralized Store (Reducer/Context) for App State.
- Service layer for business logic (`LayerService`, `ObjectService`, `MachineService`).
- Reusable Design System components concepts (Panels cleanup).
- strict TypeScript typing and removal of `any`.
Acceptance:
- `App.tsx` size reduced significantly (~300 lines).
- All UI components use the new Store.
- No regression in features (Add Rect, Move Layer, Export still work).

Milestone 9 — Advanced Modes (Line / Fill) (Released)
Goal: Industry-standard "Line" and "Fill" logic.
Deliverables:
- **Modes**:
    - **Line**: Vector following (Cut/Score).
    - **Fill**: Raster scanning (Images & Vector Shapes).
- **Smart Logic**:
    - Auto-detect mode based on content (Image -> Fill, Vector -> Line).
    - Vector Scanline Algorithm (to fill complex vector shapes).
- **UI**:
    - Layer Mode Selector (Line / Fill).
    - Clear visual feedback for invalid combinations.
Acceptance:
- Can "Fill" a Vector Star.
- Can "Line" a Vector Box.
- Importing Image defaults to Fill.

Milestone 10 — Machine Configuration Manager (Released)
Goal: Manage multiple machine profiles (size, speed, firmware settings).
Deliverables:
- **Persistence**: Store machine profiles locally (IndexedDB/LocalStorage).
- **UI**:
    - Machine selection dropdown in Machine Panel.
    - "Manage Machines" dialog (Add/Edit/Delete).
    - Fields: Bed Size (W/H), Origin, Max Spindle, Baud Rate.
- **Integration**:
    - G-code generation uses the selected machine's bed size and S-value range.
Acceptance:
- Can create "My Diode Laser" (300x300, S1000).
- Can create "My CO2 Laser" (600x400, S100).
- Switching profile updates the "Preview" boundary box.


## Future Ideas



## Next Priorities (High Impact)
The focus for the next releases is on features that bring the most value to every user.

- [ ] **Job Estimation**: Calculate accurate time and cost estimates before running the job.
- [ ] **Material Library**: Save and recall Speed/Power presets for common materials (Plywood, Acrylic, Leather).
- [ ] **Path Optimization**: Smart path finding (Nearest Neighbor) to significantly reduce air travel time.
- [ ] **Offline Reliability**: Ensure the app works flawlessly in workshops with poor or no internet connection.

## Backlog (Future Ideas)
- **Camera Integration**: Webcam overlay for alignment.
- **Mobile Layout**: Improved UI for phone control.
- **Parametric Shapes**: Built-in generators for gears and boxes.



