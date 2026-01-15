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

Milestone 7 — UI Refactoring & UX Simplification (In Progress)
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

## Future Ideas

- **Raster Improvements**: Brightness/Contrast adjustment, Dithering algorithms (Floyd-Steinberg).
- **Material Library**: Presets for Speed/Power based on material.
- **Parametric Shapes**: Circle, Star, Gear generators.

