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
