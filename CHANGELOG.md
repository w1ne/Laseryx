# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-23

### Added
- **PWA Support**: Fully offline-capable Progressive Web App with installation support.
- **Machine Selection**: Support for GRBL 1.1+ based laser cutters (Diode/CO2).
- **Design Workspace**:
    - Import SVG vectors and Raster images (PNG/JPG).
    - Basic primitives (Rectangle).
    - Layer management (ordering, visibility).
    - Multi-select and transform (Move, Scale).
- **CAM Engine**:
    - Local G-code generation in Web Worker.
    - Configurable operations (Vector Cut, Raster Engrave).
    - Material Library for saving feed/speed presets.
    - Smart "Generate" & "Download" workflow.
- **Machine Control**:
    - Direct connection via Web Serial API.
    - Jog controls, Homing ($H), and Unlock ($X).
    - Real-time position (DRO) and job status streaming.
- **UI**:
    - Properties panel with high-precision inputs (2 decimal places).
    - About dialog with attribution and source links.
    - "Buy Me A Coffee" integration.
- **Documentation**:
    - Comprehensive README with setup guide.
    - Architecture and Roadmap docs.
- **License**: CC BY-NC-SA 4.0.

### Fixed
- Fixed `crypto.randomUUID` error in non-secure contexts (HTTP).
- Fixed excessive precision in Properties panel inputs (rounded to 2 decimals).
- Fixed build configuration for relative paths (`./`) in Vite.

### Changed
- Refactored G-code generation workflow to separate generation from streaming/downloading.
- Updated project structure to use Yarn workspaces (if applicable, or just structure cleanups).
