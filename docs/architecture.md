# File: docs/architecture.md

# Architecture (PWA-only, Linux-first, TS Worker core)

High-level
- A single PWA built with Vite + React + TypeScript under `apps/pwa`.
- All CAM and G-code generation runs in a Web Worker (TypeScript), not in the UI thread.
- UI remains responsive; core remains portable.

Runtime components
1) UI thread (React)
- Editor state, selection, transforms, layer management.
- Renders vectors and previews (Canvas/WebGL/SVG—implementation choice).
- Performs persistence (IndexedDB) and import/export (File API).
- Owns Web Serial device control.
- Current Milestone 0 wiring: `apps/pwa/src/ui/App.tsx` calls `createWorkerClient` and displays "pong".

2) Core worker (TypeScript)
- Document normalization (flatten transforms, path conversion).
- Geometry utilities (polyline ops, bbox, ordering).
- CAM planner (vector toolpaths + raster scanlines later).
- G-code emitter (GRBL-oriented, configurable).
- Milestone 0 uses a minimal core (`apps/pwa/src/core/ping.ts`) to prove the worker boundary.

Hard boundaries
- apps/pwa/src/core must not import from:
  - window/document
  - canvas/webgl
  - indexeddb
  - navigator.serial
- apps/pwa/src/io contains all browser integrations.

Current module layout (Milestone 0)
- apps/pwa/src/core
  - ping.ts (pure core entry used by the worker)
- apps/pwa/src/shared
  - workerProtocol.ts (shared request/response types)
  - ids.ts (request id helper)
- apps/pwa/src/worker
  - handler.ts (pure request router)
  - worker.ts (postMessage adapter)
- apps/pwa/src/ui
  - App.tsx (renders "pong" from worker)
  - workerClient.ts (UI-side RPC helper)
- apps/pwa/src/io
  - registerServiceWorker.ts
- apps/pwa/public
  - manifest.webmanifest
  - sw.js
  - icon.svg

Planned core layout (within `apps/pwa`)
- apps/pwa/src/core/model
  - document types, layer/object definitions
- apps/pwa/src/core/geom
  - transforms, polyline utils, bbox, path flattening
- apps/pwa/src/core/cam
  - vector planning, ordering, pass generation
  - later: raster planning
- apps/pwa/src/core/gcode
  - dialect config, emitter, S-range mapping
- apps/pwa/src/worker
  - message router, calls into core
- apps/pwa/src/io
  - project storage (IndexedDB)
  - import/export helpers
  - web serial driver (GRBL)
- apps/pwa/src/ui
  - editor, panels, preview, machine tab

Project persistence (local-first)
- Store projects in IndexedDB:
  - document.json
  - assets (images) keyed by content hash (later)
  - settings (cam + machine profile)
- Export: generate .gcode file for download (MVP).
- Project file packaging (zip) is optional later; do not block MVP on it.

Machine control (GRBL-only, later milestone)
- A "Machine" tab that is disabled if Web Serial is unavailable.
- Streaming starts with ack-mode (line -> wait ok/error -> next).
- Buffered streaming can be added later without changing the core.

Why this structure stays portable
- All “hard stuff” (CAM/G-code) is isolated behind a message protocol.
- Replacing the worker implementation later does not require rewriting UI or IO layers.
