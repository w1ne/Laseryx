# LaserFather PWA

Short guide to the repo layout:
- apps/pwa: PWA app (UI, worker, core, and browser integrations)
- docs: roadmap, architecture, and interface specs
- package.json: root scripts that proxy into apps/pwa

Key subfolders in apps/pwa/src:
- core: pure TS CAM + G-code engine (no browser APIs)
- worker: Web Worker entry and message router
- ui: React UI
- io: browser integrations (IndexedDB, Web Serial, service worker)
- shared: shared types and helpers across UI/worker

Tests:
- apps/pwa/src/**/*.test.ts: unit tests
- apps/pwa/tests/golden: golden G-code fixtures
