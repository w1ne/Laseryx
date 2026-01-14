# File: docs/agents.md

# Agents Guide (PWA-only, Linux-first, no WASM)

Scope (current)
- Platform: Linux desktop.
- Runtime: Chromium-based browser (Chrome/Chromium/Edge).
- Form factor: PWA (offline-capable design/CAM/export).
- Machine control: GRBL over USB-serial via Web Serial.
- Features: Vector Import (SVG), Raster Engraving (Images), G-code Export.
- No WASM. Core runs as TypeScript in a Web Worker.

Non-goals (for now)
- No native desktop wrapper.
- No device-bridge service.
- No DSP/Galvo controllers.
- No cross-platform guarantees beyond “works in Chromium on Linux”.

Core principles
1) Keep the core engine pure and portable
- Core code must be independent of DOM, Canvas, File APIs, Web Serial, IndexedDB.
- Core receives plain data (JSON + typed arrays) and returns plain data.

2) One stable boundary: UI <-> Worker
- The core runs inside a dedicated Web Worker.
- UI only communicates with the worker via a strict message protocol (docs/interfaces.md).
- This makes later migration (e.g., to WASM or native) a drop-in replacement.

3) Determinism is a feature
- Given the same input document + settings + machine profile:
  toolpath plan and G-code must match exactly.
- Any algorithm with variability must accept an explicit seed and default to a fixed seed.

4) Vertical slices over big-bang editor work
- First deliverable is deterministic G-code export.
- Web Serial control comes after export is correct.

Definition of Done (any PR)
- `pnpm build` or `npm run build` succeeds.
- `npm test` (unit + golden) passes.
- Worker protocol changes updated in docs/interfaces.md.
- No new TODO without an issue link.

Repo structure (single app, minimal)
- /apps/pwa
  - /src/core       (pure TS core, no browser APIs)
  - /src/worker     (worker entry + adapter)
  - /src/ui         (React components)
  - /src/io         (IndexedDB, import/export, Web Serial)
  - /tests/golden   (fixtures + expected outputs)
- /docs             (these docs)

Agent workflow
- Implement Milestones in docs/roadmap.md in order.
- Do not add features outside the current milestone unless required to unblock it.
