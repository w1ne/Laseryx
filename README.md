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

## Features

### 🎨 Design Workspace
- **Vector & Raster Support**: Import `.svg`, `.png`, and `.jpg` files.
- **Smart conversion**: Automatically converts images to scanlines and shapes to paths.
- **Layer Management**: Reorder, hide, and lock layers for complex compositions.
- **Premium UI**: localized, light-themed interface with 3D-style controls.

### ⚙️ CAM Engine
- **Configurable Operations**: Assign Cut, Vector Engrave, or Raster Engrave.
- **Material Profiles**: Save speed/power settings for different materials (Wood, Acrylic, Leather).
- **Offline Capable**: All processing happens locally in the browser.

### 🤖 Machine Control
- **Direct Connection**: Web Serial API support for connecting directly to GRBL firmware (v1.1+).
- **Split View Interface**: Optimized layout with controls on the left and a large, live preview on the right.
- **Live Preview**: Real-time visualization of the machine bed and laser head position.
- **Reliability**: Optimized streaming/buffering for smooth motion without "jerks".
- **Simulation**: Built-in simulator for testing workflows without physical hardware.

---

## Getting Started

### Prerequisites
- Node.js >= 18 (Required for Vite/Esbuild)
- A modern browser (Chrome/Edge recommended for Web Serial support)

### Installation
```bash
npm install
```

### Development
Run the local dev server:
```bash
npm run dev
```

### Testing
Run unit and integration tests:
```bash
npm run test
```

> **Note on Testing**: The test suite automatically uses a **Simulated Driver** to verify G-code generation and streaming logic without needing a real machine connected.

---

## Linux Setup & Troubleshooting

### Serial Connection Issues
If you see **"Failed to open serial port"** or cannot connect:

1.  **Permissions**: Ensure your user is in the `dialout` group:
    ```bash
    sudo usermod -a -G dialout $USER
    # You MUST log out and log back in (or restart) for this to take effect!
    ```

2.  **ModemManager Interference**: Ubuntu/Debian often tries to grab serial devices. Disable it:
    ```bash
    sudo systemctl stop ModemManager
    sudo systemctl disable ModemManager
    ```
