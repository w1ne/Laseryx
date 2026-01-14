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

## getting started

**Prerequisites:** Node.js >=18 (v12 is too old for current dependencies).

### installation
```bash
npm install
```

### run locally
```bash
npm run dev
```

### run tests
```bash
npm run test
```

### Linux setup

If you cannot connect to the device (Status: "Failed to open serial port"):

1.  **Permissions**: Ensure your user is in the `dialout` group:
    ```bash
    sudo usermod -a -G dialout $USER
    # You MUST log out and log back in for this to take effect!
    ```

2.  **Interference**: If it still fails, stop ModemManager (it grabs serial ports):
    ```bash
    sudo systemctl stop ModemManager
    sudo systemctl disable ModemManager
    ```
