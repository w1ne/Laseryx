# Architecture

Laseryx is a Linux-first, PWA-only application. It uses React for the UI and a TypeScript Worker for the core logic.

## High Level

We built a single PWA. You will find it in `apps/pwa`. All the heavy math runs in a Web Worker so the UI stays fast. The core CAM logic is portable and does not depend on the browser UI.

## Runtime Components

**The UI Thread**
This is where React lives. It handles the editor state and layer management. It renders your vectors and images. It also manages saving data to your browser's database. This thread owns the Web Serial connection to your machine.

**The Core Worker**
This runs in the background. It normalizes your documents. It handles all geometry math like transforms and bounding boxes. It generates the toolpaths for vector cuts and raster engraves. Finally, it turns those toolpaths into G-code.

## Hard Boundaries

We have strict rules for `apps/pwa/src/core`. It cannot touch the DOM or the window object. It cannot use Canvas or WebGL directly. It cannot access IndexedDB or Serial ports. All browser integrations live in `apps/pwa/src/io` instead.

## Module Layout

**Core (`apps/pwa/src/core`)**
This folder holds the logic. `model.ts` defines our types. `geom.ts` handles math. `cam.ts` plans the cuts. `raster.ts` converts images. `gcode.ts` writes the final output.

**Shared (`apps/pwa/src/shared`)**
These types are used by both the UI and the Worker. This keeps them in sync.

**Worker (`apps/pwa/src/worker`)**
This is the bridge. It receives messages from the UI and calls the Core functions.

**UI (`apps/pwa/src/ui`)**
This is what you see. `App.tsx` is the main container. `MachinePanel` controls the laser.

**IO (`apps/pwa/src/io`)**
This connects to the outside world. `grblDriver.ts` talks to your machine via USB.

## Persistence

We save your work locally using IndexedDB. We store the document JSON and settings. You can export your result as a `.gcode` file.

## Machine Control

The Machine tab handles the laser. It disables itself if you cannot connect via Serial. We stream G-code one line at a time. We wait for an "ok" from the machine before sending the next line.

## Portability

We keep the hard stuff isolated. We hide it behind a message protocol. This means we can change the core engine later without breaking the UI.
